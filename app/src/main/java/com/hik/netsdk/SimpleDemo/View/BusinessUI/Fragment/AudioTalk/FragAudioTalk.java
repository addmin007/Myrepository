package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.AudioTalk;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;

import com.hikvision.netsdk.VoiceDataCallBack;
import com.hik.netsdk.SimpleDemo.Control.DevAlarmGuider;
import com.hik.netsdk.SimpleDemo.Control.DevConfigGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Alarm.FragAlarm;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Configure.CommonMethod;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack.FragPlayBackByFile;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hikvision.netsdk.AlarmCallBack_V30;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_ALARMER;
import com.hikvision.netsdk.NET_DVR_BASE_ALARM;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class FragAudioTalk extends FragBase {
    public static final String ARGS_PAGE = "args_page";

    private Button btn_transmit = null;
    private Button btn_intercom = null;
    private Button btn_stop = null;

    private int m_lVoiceTalkHandle = -1;

    public static FragAudioTalk newInstance(MainActivity mainActivity, Bundle args) {
        FragAudioTalk fragment = new FragAudioTalk();
        fragment.setSDKGuider(mainActivity);
        if(args!=null)
        {
            fragment.setArguments(args);
        }
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        final View rootView = inflater.inflate(R.layout.frag_audiotalk, container, false);

        /******************开启转发  transmit****************/
        //绑定button资源
        btn_transmit = (Button)rootView.findViewById(R.id.button_transmit);
        //设置button监听
        btn_transmit.setOnClickListener(new View.OnClickListener() {
            //@Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        if(fnVoiceDataCallBack == null)
                        {
                            fnVoiceDataCallBack = new VoiceDataCallBackImpl();
                        }
                        
                        m_lVoiceTalkHandle = HCNetSDK.getInstance().NET_DVR_StartVoiceCom_MR_V30(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,
                                1, fnVoiceDataCallBack);
                        if(m_lVoiceTalkHandle == -1)
                        {
                            System.out.println("NET_DVR_StartVoiceCom_MR_V30 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError());
                        }
                    }
                }
                else
                {
                    Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
                }

            }
        });

        /******************开启对讲 jna****************/
        //绑定button资源
        btn_intercom = (Button)rootView.findViewById(R.id.button_intercom);
        //设置button监听
        btn_intercom.setOnClickListener(new View.OnClickListener() {
            //@Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        if(fnVoiceDataCallBack == null)
                        {
                            fnVoiceDataCallBack = new VoiceDataCallBackImpl();
                        }

                        m_lVoiceTalkHandle = HCNetSDK.getInstance().NET_DVR_StartVoiceCom_MR_V30(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,
                                1, fnVoiceDataCallBack);
                        if(m_lVoiceTalkHandle == -1)
                        {
                            System.out.println("NET_DVR_StartVoiceCom_V30 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError());
                        }
                    }
                }
                else
                {
                    Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
                }

            }
        });

        /*************关闭对讲********************/
        //绑定button资源
        btn_stop = (Button)rootView.findViewById(R.id.button_audiotalk_stop);
        //设置button监听
        btn_stop.setOnClickListener(new View.OnClickListener() {
            //@Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        if(!HCNetSDK.getInstance().NET_DVR_StopVoiceCom(m_lVoiceTalkHandle))
                        {
                            System.out.println("NET_DVR_StopVoiceCom failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError());
                        }
                    }
                }
                else
                {
                    Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
                }

            }
        });
        return rootView;
    }


    private static VoiceDataCallBack fnVoiceDataCallBack = null;
    public class VoiceDataCallBackImpl implements VoiceDataCallBack {
        @Override
        public void fVoiceDataCallBack(int lVoiceComHandle, byte[] pRecvDataBuffer, int dwBufSize, int byAudioFlag) {

        }
    }


}

