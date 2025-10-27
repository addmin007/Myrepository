package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview;

import android.graphics.PixelFormat;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AppCompatActivity;
import android.view.Surface;
import android.view.SurfaceView;
import android.view.SurfaceHolder;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.app.Activity;
import android.widget.AdapterView;
import android.view.MotionEvent;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack.FragPlayBackByTime;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO;

public class FragPreviewBySurfaceView extends MyActivityBase implements View.OnClickListener,SurfaceHolder.Callback {
    private SurfaceView m_osurfaceView = null;
    private int m_iPreviewHandle = -1; // playback
    private int m_iSelectChannel = -1;
    private int m_iSelectStreamType = -1;
    private int m_iUserID = -1; // return by NET_DVR_Login_v30

    private int m_byChanNum = 0;// analog channel nums
    private int m_byStartChan = 0;//start analog channel

    private int m_IPChanNum = 0;//digital channel nums
    private int m_byStartDChan = 0;//start digital channel

    private List<String> m_data_list_channel, m_data_list_stream;
    private Spinner m_bystream_spinner, m_bychannel_spinner;
    private ArrayAdapter<String> m_streamtype_adapter, m_arrchannel_adapter;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_frag_preview_surfaceview);

        findViewById(R.id.button_preview_start).setOnClickListener(this);
        findViewById(R.id.button_preview_snap).setOnClickListener(this);
        findViewById(R.id.button_preview_stop).setOnClickListener(this);
        findViewById(R.id.button_preview_record).setOnClickListener(this);

        //channel spinner
        m_bychannel_spinner= (Spinner) findViewById(R.id.bychan_spinner);

        //Channel type
        DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
        if(deviceInfo == null){
            Toast.makeText(FragPreviewBySurfaceView.this,"get the deviceInfo failed",Toast.LENGTH_SHORT).show();
            return;
        }
        m_iUserID = deviceInfo.m_lUserID;
        m_byChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byChanNum;
        m_byStartChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan;

        m_IPChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byIPChanNum + deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byHighDChanNum * 256;
        m_byStartDChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan ;

        int iAnalogStartChan = m_byStartChan;
        int iDigitalStartChan = m_byStartDChan;
        m_data_list_channel = new ArrayList<String>();

        for(int idexChanNum = 0;idexChanNum < m_byChanNum; idexChanNum++) {
            m_data_list_channel.add("ACamera_"+ iAnalogStartChan);
            iAnalogStartChan++;
        }

        for(int idexChanNum = 0;idexChanNum < m_IPChanNum; idexChanNum++) {

            m_data_list_channel.add("DCamera_"+ iDigitalStartChan);
            iDigitalStartChan++;
        }
        m_arrchannel_adapter= new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, m_data_list_channel);
        m_arrchannel_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        m_bychannel_spinner.setAdapter(m_arrchannel_adapter);

        //stream spinner
        m_bystream_spinner= (Spinner) findViewById(R.id.stream_spinner_surface);
        //stream Type
        m_data_list_stream = new ArrayList<String>();
        m_data_list_stream.add("main_stream");
        m_data_list_stream.add("sub_stream");
        m_data_list_stream.add("third_stream");
        m_streamtype_adapter = new ArrayAdapter<String>(FragPreviewBySurfaceView.this, android.R.layout.simple_spinner_item, m_data_list_stream);
        m_streamtype_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        m_bystream_spinner.setAdapter(m_streamtype_adapter);
        m_bystream_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {//通过此方法为下拉列表设置点击事件
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                m_iSelectStreamType = i;
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });


        m_bychannel_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {//通过此方法为下拉列表设置点击事件
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                String text= m_bychannel_spinner.getItemAtPosition(i).toString();
                m_iSelectChannel = Integer.valueOf(GetChannel(text)).intValue();
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        //Surface
        m_osurfaceView = findViewById(R.id.Surface_Preview_Play);
        m_osurfaceView.getHolder().addCallback(this);
        m_osurfaceView.setZOrderOnTop(true);

    }

    public String GetChannel(String inPutStr) {

        String regEx="[^0-9]";
        Pattern p = Pattern.compile(regEx);
        Matcher m = p.matcher(inPutStr);
        return m.replaceAll("").trim();

    }
    // @Override
    public void surfaceCreated(SurfaceHolder holder) {
        m_osurfaceView.getHolder().setFormat(PixelFormat.TRANSLUCENT);
        if (-1 == m_iPreviewHandle) {
            return;
        }
        Surface surface = holder.getSurface();
        if (surface.isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlaySurfaceChanged_jni(m_iPreviewHandle, 0, holder))
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width,
                               int height) {
        // m_osurfaceView.setZOrderOnTop(true);
        //Toast.makeText(FragPlayBackByTime.this,"surfaceChanged" + m_iPort ,Toast.LENGTH_SHORT).show();
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        if (-1 == m_iPreviewHandle) {
            return;
        }
        if (holder.getSurface().isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlaySurfaceChanged_jni(m_iPreviewHandle, 0, null))
            {
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_RealPlaySurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
        }
    }


    @Override
    protected void onDestroy() {
        if(m_iPreviewHandle != -1){
            SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle);
            m_iPreviewHandle = -1;
        }
        super.onDestroy();
    }

    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.button_preview_start:
                if(m_iPreviewHandle != -1){
                    SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle);
                }

                NET_DVR_PREVIEWINFO struPlayInfo = new NET_DVR_PREVIEWINFO();
                struPlayInfo.lChannel = m_iSelectChannel;
                struPlayInfo.dwStreamType = m_iSelectStreamType;
                struPlayInfo.bBlocked = 1;
                m_osurfaceView = findViewById(R.id.Surface_Preview_Play);
                struPlayInfo.hHwnd = m_osurfaceView.getHolder();
                m_iPreviewHandle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(m_iUserID,struPlayInfo, null);
                if (m_iPreviewHandle < 0)
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_RealPlay_V40 fail, Err:"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_RealPlay_V40 Succ " ,Toast.LENGTH_SHORT).show();

                break;
            case R.id.button_preview_stop:
                if (!SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle))
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_StopRealPlay m_iPreviewHandle：" + m_iPreviewHandle
                            + "  error:" + SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                m_iPreviewHandle = -1;
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_StopRealPlay Succ",Toast.LENGTH_SHORT).show();
                break;

            case R.id.button_preview_snap:
                if (m_iPreviewHandle < 0)
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"please start preview first",Toast.LENGTH_SHORT).show();
                    return;
                }
                if(!SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Snap(m_iPreviewHandle, "/mnt/sdcard/test.bmp"))
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_CapturePicture fail, Err:"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_CapturePicture Succ",Toast.LENGTH_SHORT).show();
                break;
            case R.id.button_preview_record:
                if (m_iPreviewHandle < 0)
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"please start preview first",Toast.LENGTH_SHORT).show();
                    return;
                }
                if(!SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Record(m_iPreviewHandle,1,  "/mnt/sdcard/test.mp4"))
                {
                    Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_SaveRealData_V30 fail, Err:"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Toast.makeText(FragPreviewBySurfaceView.this,"NET_DVR_SaveRealData_V30 Succ",Toast.LENGTH_SHORT).show();
                break;
        }
    }
}
