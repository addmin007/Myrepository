"""
unimof/tasks/unimof_1bar.py

1-bar 专用 Task：在 unimof_v2 Task 基础上，额外加载 pv_cm3g 字段，
拼接为 8-dim structure_features_ext 送给 UniMOF1barModel。
"""

import logging
import os
import numpy as np
import torch

from unicore.data import (
    Dictionary,
    NestedDictionaryDataset,
    RawArrayDataset,
    RawNumpyDataset,
    AppendTokenDataset,
    PrependTokenDataset,
    RightPadDataset,
    EpochShuffleDataset,
    TokenizeDataset,
    RightPadDataset2D,
    RawLabelDataset,
)
from unimof.data import (
    KeyDataset,
    LMDBDataset,
    ToTorchDataset,
    DistanceDataset,
    EdgeTypeDataset,
    PrependAndAppend2DDataset,
    RightPadDatasetCoord,
    RemoveHydrogenDataset,
    CroppingDataset,
    NormalizeDataset,
)
from unicore.tasks import UnicoreTask, register_task
from unicore import checkpoint_utils

logger = logging.getLogger(__name__)


class PVExtendDataset(torch.utils.data.Dataset):
    """
    从 lmdb dataset 中读取 structure_features (7-dim) 和 pv_cm3g，
    拼接成 8-dim structure_features_ext。
    """
    def __init__(self, dataset):
        self.dataset = dataset

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        sf = self.dataset[idx]['structure_features']   # np.array [7]
        pv = np.array([self.dataset[idx].get('pv_cm3g', 0.0)], dtype=np.float32)
        return np.concatenate([sf, pv], axis=0)        # [8]


@register_task("unimof_1bar")
class UniMOF1barTask(UnicoreTask):
    """Task for 1-bar CH4 adsorption prediction with LoRA adapter."""

    @staticmethod
    def add_args(parser):
        # Task-only args; all model/backbone args are registered in UniMOF1barModel.add_args
        parser.add_argument("data", help="downstream data path")
        parser.add_argument("--task-name", type=str, default='S1_CH4_1bar_fixed',
                            help="dataset name (must match a key in ATTR_REGESTRY)")
        parser.add_argument("--dict-name", default="dict.txt",
                            help="atom dictionary filename")

    def __init__(self, args, dictionary):
        super().__init__(args)
        self.dictionary = dictionary
        self.seed = args.seed
        self.mask_idx = dictionary.add_symbol("[MASK]", is_special=True)

    @classmethod
    def setup_task(cls, args, **kwargs):
        dictionary = Dictionary.load(os.path.join(args.data, args.dict_name))
        logger.info("dictionary: {} types".format(len(dictionary)))
        return cls(args, dictionary)

    def load_dataset(self, split, **kwargs):
        split_path = os.path.join(self.args.data, self.args.task_name, split + ".lmdb")
        dataset = LMDBDataset(split_path)

        tgt_dataset = KeyDataset(dataset, "target")
        tgt_dataset = ToTorchDataset(tgt_dataset, dtype='float32')

        if self.args.remove_hydrogen:
            dataset = RemoveHydrogenDataset(dataset, "atoms", "coordinates")
        dataset = CroppingDataset(dataset, self.seed, "atoms", "coordinates", self.args.max_atoms)
        dataset = NormalizeDataset(dataset, "coordinates")

        src_dataset   = KeyDataset(dataset, "atoms")
        src_dataset   = TokenizeDataset(src_dataset, self.dictionary,
                                        max_seq_len=getattr(self.args, 'max_seq_len', 1024))
        coord_dataset = KeyDataset(dataset, "coordinates")

        gas               = KeyDataset(dataset, "gas")
        gas_attr          = KeyDataset(dataset, "gas_attr")
        pressure          = KeyDataset(dataset, "pressure")
        temperature       = KeyDataset(dataset, "temperature")
        task_name         = KeyDataset(dataset, "task_name")
        structure_features = KeyDataset(dataset, "structure_features")
        # 8-dim 扩展特征（含 pv）
        structure_features_ext = PVExtendDataset(dataset)

        def PrependAndAppend(ds, pre, app):
            return AppendTokenDataset(PrependTokenDataset(ds, pre), app)

        src_dataset     = PrependAndAppend(src_dataset,
                                           self.dictionary.bos(), self.dictionary.eos())
        edge_type       = EdgeTypeDataset(src_dataset, len(self.dictionary))
        coord_dataset   = ToTorchDataset(coord_dataset, 'float32')
        distance_dataset = DistanceDataset(coord_dataset)
        coord_dataset   = PrependAndAppend(coord_dataset, 0.0, 0.0)
        distance_dataset = PrependAndAppend2DDataset(distance_dataset, 0.0)

        nest_dataset = NestedDictionaryDataset({
            "net_input": {
                "src_tokens": RightPadDataset(src_dataset, pad_idx=self.dictionary.pad()),
                "src_coord":  RightPadDatasetCoord(coord_dataset, pad_idx=0),
                "src_distance": RightPadDataset2D(distance_dataset, pad_idx=0),
                "src_edge_type": RightPadDataset2D(edge_type, pad_idx=0),
                "gas":         RawNumpyDataset(gas),
                "gas_attr":    RawNumpyDataset(gas_attr),
                "temperature": RawNumpyDataset(temperature),
                "pressure":    RawNumpyDataset(pressure),
                "structure_features":     RawNumpyDataset(structure_features),
                "structure_features_ext": RawNumpyDataset(structure_features_ext),
            },
            "task_name": RawArrayDataset(task_name),
            "target":    {"finetune_target": tgt_dataset},
        })

        if split in ["train", "train.small"]:
            nest_dataset = EpochShuffleDataset(nest_dataset, len(nest_dataset), self.args.seed)
        self.datasets[split] = nest_dataset

    def build_model(self, args):
        from unicore import models
        model = models.build_model(args, self)
        # 权重加载在 UniMOF1barModel.build_model 中处理
        return model
