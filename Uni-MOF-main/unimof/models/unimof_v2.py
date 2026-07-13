# Copyright (c) DP Technology.
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

import logging
import torch
import torch.nn as nn
import torch.nn.functional as F
from unicore import utils
from unicore.models import BaseUnicoreModel, register_model, register_model_architecture
from unicore.modules import LayerNorm, init_bert_params
from .unimat import UniMatModel
from typing import Dict, Any, List


logger = logging.getLogger(__name__)

MIN_MAX_KEY = {
    'Tobacco_CH4':{
        'pressure': [0.5, 2.5],        # log10(P/bar), actual data range [0.78, 2.00]
        'temperature': [290.0, 310.0], # dataset is fixed at 298 K; narrow window keeps bin resolution meaningful
    },
    'S1_CH4_1bar':{
        'pressure': [0.0, 2.5],       # covers 1 bar (log10=0) to 100 bar (log10=2.0) for multi-task
        'temperature': [290.0, 310.0], # all 298.15 K
    },
    'S1_CH4_1bar_fixed':{
        'pressure': [-0.1, 0.1],      # log10(1 bar) = 0, narrow window for 1-bar-only model
        'temperature': [290.0, 310.0], # all 298.15 K
    },
    'hmof':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P) [-2, 1.0]
        'temperature': [100, 400.0],   # only 298k, 273k is used
    },
    'CoRE':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P)
        'temperature': [100, 400.0],  
    },
    'CoRE_MAP':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P)
        'temperature': [100, 400.0],  
    },
    'CoRE_MAP_LargeScale':{
        'pressure': [-4.0, 8.0],      # transoformed pressure in log10(P)
        'temperature': [100, 500.0],  
    },
    'CoRE_DB':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P)
        'temperature': [70, 90.0],
    },

    'EXP_ADS':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P)
        'temperature': [100, 400.0],
    },
    'EXP_ADS_hmof':{
        'pressure': [-4.0, 6.0],      # transoformed pressure in log10(P) [-2, 1.0]
        'temperature': [100, 400.0],   # only 298k, 273k is used
    },
}

@register_model("unimof_v2")
class UniMOFV2Model(BaseUnicoreModel):
    def add_args(parser):
        """Add model-specific arguments to the parser."""
        parser.add_argument(
            "--gas-attr-input-dim",
            type=int,
            default=4,
            help="size of gas feature",
        )
        parser.add_argument(
            "--hidden-dim",
            type=int,
            default=128,
            help="output dimension of embedding",
        )
        parser.add_argument(
            "--bins",
            type=int,
            default=32,
            help="number of bins for temperature and pressure",
        )
        parser.add_argument(
            "--pooler-activation-fn",
            type=str,
            default="tanh",
            help="pooler activation function",
        )
        parser.add_argument(
            "--pooler-dropout",
            type=float,
            default=0.1,
            help="pooler dropout",
        )
        parser.add_argument(
            "--mono-loss-weight",
            type=float,
            default=0.1,
            help="weight for monotonicity physics prior loss",
        )
        parser.add_argument(
            "--mc-dropout-samples",
            type=int,
            default=0,
            help="number of MC dropout forward passes for uncertainty estimation (0=disabled)",
        )
        parser.add_argument(
            "--structure-feature-dim",
            type=int,
            default=7,
            help="dimension of MOF structure features (LCD, PLD, LFPD, Density, ASA_m2cm3, ASA_m2g, VF)",
        )
        parser.add_argument(
            "--dropout",
            type=float,
            default=0.1,
            help="dropout probability for transformer layers",
        )
        parser.add_argument(
            "--emb-dropout",
            type=float,
            default=0.1,
            help="dropout probability for embeddings",
        )
        parser.add_argument(
            "--attention-dropout",
            type=float,
            default=0.1,
            help="dropout probability for attention weights",
        )
        parser.add_argument(
            "--activation-dropout",
            type=float,
            default=0.0,
            help="dropout probability after activation in FFN",
        )

    def __init__(self, args, dictionary):
        super().__init__()
        base_architecture(args)
        self.args = args
        self.unimat = UniMatModel(self.args, dictionary)
        self.min_max_key = MIN_MAX_KEY[args.task_name]
        self.gas_embed = GasModel(self.args.gas_attr_input_dim, self.args.hidden_dim)
        self.env_embed = EnvModel(self.args.hidden_dim, self.args.bins, self.min_max_key)
        self.structure_embed = StructureFeatureModel(self.args.structure_feature_dim, self.args.hidden_dim)

        self.classifier = ClassificationHead(args.encoder_embed_dim + self.args.hidden_dim * 6, 
                                self.args.hidden_dim * 2, 
                                self.args.num_classes, 
                                self.args.pooler_activation_fn,
                                self.args.pooler_dropout)

    @classmethod
    def build_model(cls, args, task):
        """Build a new model instance."""
        return cls(args, task.dictionary)

    def forward(
        self,
        gas,
        gas_attr,
        pressure,
        temperature,
        src_tokens,
        src_distance,
        src_coord,
        src_edge_type,
        structure_features=None,
        encoder_masked_tokens=None,
        **kwargs
    ):
        """Forward pass for the UniMofAbsorbModel model."""
        def get_dist_features(dist, et):
            n_node = dist.size(-1)
            gbf_feature = self.unimat.gbf(dist, et)
            gbf_result = self.unimat.gbf_proj(gbf_feature)
            graph_attn_bias = gbf_result
            graph_attn_bias = graph_attn_bias.permute(0, 3, 1, 2).contiguous()
            graph_attn_bias = graph_attn_bias.view(-1, n_node, n_node)
            return graph_attn_bias

        padding_mask = src_tokens.eq(self.unimat.padding_idx)
        mol_x = self.unimat.embed_tokens(src_tokens)
        graph_attn_bias = get_dist_features(src_distance, src_edge_type)
        encoder_outputs = self.unimat.encoder(mol_x, padding_mask=padding_mask, attn_mask=graph_attn_bias)
        cls_repr = encoder_outputs[0][:, 0, :] # CLS, shape of cls_repr is [batch_size, encoder_embed_dim]

        gas_embed = self.gas_embed(gas, gas_attr) # shape of gas_embed is [batch_size, gas_dim*2]
        env_embed = self.env_embed(pressure, temperature) # shape of gas_embed is [batch_size, env_dim*3]
        structure_embed = self.structure_embed(structure_features) # shape of structure_embed is [batch_size, hidden_dim]

        rep = torch.cat([cls_repr, gas_embed, env_embed, structure_embed], dim=-1)

        logits = self.classifier(rep)

        return [logits]
        
    def set_num_updates(self, num_updates):
        """State from trainer to pass along to model at every update."""
        self._num_updates = num_updates

    def get_num_updates(self):
        return self._num_updates

class GasModel(nn.Module):
    def __init__(self, gas_attr_input_dim, gas_dim, gas_max_count=500):
        super().__init__()
        self.gas_embed = nn.Embedding(gas_max_count, gas_dim)
        self.gas_attr_embed = NonLinearHead(gas_attr_input_dim, gas_dim, 'relu')

    def forward(self, gas, gas_attr):
        gas = gas.long()
        gas_attr = gas_attr.type_as(self.gas_attr_embed.linear1.weight)
        gas_embed = self.gas_embed(gas)  # shape of gas_embed is [batch_size, gas_dim]
        gas_attr_embed = self.gas_attr_embed(gas_attr)  # shape of gas_attr_embed is [batch_size, gas_dim]
        # gas_embed = torch.cat([gas_embed, gas_attr_embed], dim=-1)
        gas_repr = torch.concat([gas_embed, gas_attr_embed], dim=-1)
        return gas_repr

class EnvModel(nn.Module):
    def __init__(self, hidden_dim, bins=32, min_max_key=None):
        super().__init__()
        self.project = NonLinearHead(2, hidden_dim, 'relu')
        self.bins = bins
        self.pressure_embed = nn.Embedding(bins, hidden_dim)
        self.temperature_embed = nn.Embedding(bins, hidden_dim)
        self.min_max_key = min_max_key
        
    def forward(self, pressure, temperature):
        pressure = pressure.type_as(self.project.linear1.weight)
        temperature = temperature.type_as(self.project.linear1.weight)
        pressure = torch.clamp(pressure, self.min_max_key['pressure'][0], self.min_max_key['pressure'][1])
        temperature = torch.clamp(temperature, self.min_max_key['temperature'][0], self.min_max_key['temperature'][1])
        pressure = (pressure - self.min_max_key['pressure'][0]) / (self.min_max_key['pressure'][1] - self.min_max_key['pressure'][0])
        temperature = (temperature - self.min_max_key['temperature'][0]) / (self.min_max_key['temperature'][1] - self.min_max_key['temperature'][0])
        # shapes of pressure and temperature both are [batch_size, ]
        env_project = torch.cat((pressure[:, None], temperature[:, None]), dim=-1)
        env_project = self.project(env_project)  # shape of env_project is [batch_size, env_dim]

        pressure_bin = torch.clamp(torch.floor(pressure * self.bins).to(torch.long), 0, self.bins - 1)
        temperature_bin = torch.clamp(torch.floor(temperature * self.bins).to(torch.long), 0, self.bins - 1)
        pressure_embed = self.pressure_embed(pressure_bin)  # shape of pressure_embed is [batch_size, env_dim]
        temperature_embed = self.temperature_embed(temperature_bin)  # shape of temperature_embed is [batch_size, env_dim]
        env_embed = torch.cat([pressure_embed, temperature_embed], dim=-1)

        env_repr = torch.cat([env_project, env_embed], dim=-1)

        return env_repr

class NonLinearHead(nn.Module):
    """Head for simple classification tasks."""

    def __init__(
        self,
        input_dim,
        out_dim,
        activation_fn,
        hidden=None,
    ):
        super().__init__()
        hidden = input_dim if not hidden else hidden
        self.linear1 = nn.Linear(input_dim, hidden)
        self.linear2 = nn.Linear(hidden, out_dim)
        self.activation_fn = utils.get_activation_fn(activation_fn)

    def forward(self, x):
        x = self.linear1(x)
        x = self.activation_fn(x)
        x = self.linear2(x)
        return x

class StructureFeatureModel(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super().__init__()
        self.project = NonLinearHead(input_dim, hidden_dim, 'relu')

    def forward(self, structure_features):
        structure_features = structure_features.type_as(self.project.linear1.weight)
        return self.project(structure_features)


class ClassificationHead(nn.Module):
    """Head for sentence-level classification tasks."""

    def __init__(
        self,
        input_dim,
        inner_dim,
        num_classes,
        activation_fn,
        pooler_dropout,
    ):
        super().__init__()
        self.dense = nn.Linear(input_dim, inner_dim)
        self.activation_fn = utils.get_activation_fn(activation_fn)
        self.dropout = nn.Dropout(p=pooler_dropout)
        self.out_proj = nn.Linear(inner_dim, num_classes)

    def forward(self, features, **kwargs):
        x = features
        x = self.dropout(x)
        x = self.dense(x)
        x = self.activation_fn(x)
        x = self.dropout(x)
        x = self.out_proj(x)
        return x

@register_model_architecture("unimof_v2", "unimof_v2")
def base_architecture(args):
    args.encoder_layers = getattr(args, "encoder_layers", 8)
    args.encoder_embed_dim = getattr(args, "encoder_embed_dim", 512)
    args.encoder_ffn_embed_dim = getattr(args, "encoder_ffn_embed_dim", 2048)
    args.encoder_attention_heads = getattr(args, "encoder_attention_heads", 64)
    args.dropout = getattr(args, "dropout", 0.1)
    args.emb_dropout = getattr(args, "emb_dropout", 0.1)
    args.attention_dropout = getattr(args, "attention_dropout", 0.1)
    args.activation_dropout = getattr(args, "activation_dropout", 0.0)
    args.max_seq_len = getattr(args, "max_seq_len", 1024)
    args.activation_fn = getattr(args, "activation_fn", "gelu")
    args.post_ln = getattr(args, "post_ln", False)
    args.masked_token_loss = getattr(args, "masked_token_loss", -1.0)
    args.masked_coord_loss = getattr(args, "masked_coord_loss", -1.0)
    args.masked_dist_loss = getattr(args, "masked_dist_loss", -1.0)
    args.x_norm_loss = getattr(args, "x_norm_loss", -1.0)
    args.delta_pair_repr_norm_loss = getattr(args, "delta_pair_repr_norm_loss", -1.0)
    args.lattice_loss = getattr(args, "lattice_loss", -1.0)
    args.gas_attr_input_dim = getattr(args, "gas_attr_input_dim", 4)
    args.gas_dim = getattr(args, "hidden_dim", 128)
    args.pooler_dropout = getattr(args, "pooler_dropout", 0.0)
    args.pooler_activation_fn = getattr(args, "pooler_activation_fn", "relu")
    args.structure_feature_dim = getattr(args, "structure_feature_dim", 7)
    args.mono_loss_weight = getattr(args, "mono_loss_weight", 0.1)
    args.mc_dropout_samples = getattr(args, "mc_dropout_samples", 0)
