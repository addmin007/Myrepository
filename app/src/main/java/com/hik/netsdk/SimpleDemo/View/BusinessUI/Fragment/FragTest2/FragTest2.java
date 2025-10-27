package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragTest2;

import android.graphics.SurfaceTexture;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack.FragPlayBackByTime;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO_V20;
import com.hikvision.netsdk.NET_DVR_TIME;
import com.hikvision.netsdk.NET_DVR_VOD_PARA;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class FragTest2 extends FragBase implements TextureView.SurfaceTextureListener {
    public static final String ARGS_PAGE = "args_page";
    private int mPage;
    private TextView textView;
    private TextureView m_oTextureView = null;
    private SurfaceTexture surfacetexture;
    View rootView = null;
    private int m_iPreviewHandle = -1;
    private int m_iSelectChannel = -1;
    private int m_iSelectStreamType = -1;

    private int m_byChanNum = 0;
    private int m_byStartChan = 0;

    private int m_IPChanNum = 0;
    private int m_byStartDChan = 0;

    private List<String> m_data_list_channel, m_data_list_stream;
    private Spinner m_bystream_spinner, m_bychannel_spinner;
    private ArrayAdapter<String> m_streamtype_adapter, m_arrchannel_adapter;

    private EditText m_eStartTime;
    private EditText m_eEndTime;
    private int m_iPlayBackID = -1;

    public static FragTest2 newInstance(MainActivity mainActivity, Bundle args) {
        FragTest2 fragment = new FragTest2();
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
        mPage = 1;
    }


    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.frag_test2, container, false);
        m_oTextureView = (TextureView)rootView.findViewById(R.id.textureView2);
        m_oTextureView.setSurfaceTextureListener(this);

        m_eStartTime = (EditText)rootView.findViewById(R.id.Starttime_EditText);
        m_eStartTime.setText(getDateStr(getStartTime(), "yyyy-MM-dd HH:mm:ss"));
        m_eEndTime = (EditText)rootView.findViewById(R.id.Endtime_EditText);
        m_eEndTime.setText(getDateStr(getEndTime(), "yyyy-MM-dd HH:mm:ss"));

        //start paly button click event
        Button buttonStart = (Button)rootView.findViewById(R.id.button_preview_start);
        buttonStart.setOnClickListener(new View.OnClickListener(){
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        NET_DVR_PREVIEWINFO_V20 struPlayInfo = new NET_DVR_PREVIEWINFO_V20();
                        struPlayInfo.lChannel = m_iSelectChannel;
                        struPlayInfo.dwStreamType = m_iSelectStreamType;
                        struPlayInfo.hHwnd = new Surface(surfacetexture);
                        m_iPreviewHandle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,struPlayInfo, null);
                        if (m_iPreviewHandle < 0)
                        {
                            Toast.makeText(m_mainActivity,"NET_DVR_RealPlay_V40"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                            return;
                        }
                    }
                }
                Toast.makeText(m_mainActivity,"NET_DVR_RealPlay_V40 Succ m_iPreviewHandle：" + m_iPreviewHandle,Toast.LENGTH_SHORT).show();
            }
        });

        //stop paly button click event
        Button buttonStop = (Button)rootView.findViewById(R.id.button_preview_stop);
        buttonStop.setOnClickListener(new View.OnClickListener(){
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        if (!SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle))
                        {
                            Toast.makeText(m_mainActivity,"NET_DVR_StopRealPlay m_iPreviewHandle：" + m_iPreviewHandle
                                    + "  error:" + SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                            return;
                        }
                        Toast.makeText(m_mainActivity,"NET_DVR_StopRealPlay Succ m_iPreviewHandle：" +  m_iPreviewHandle,Toast.LENGTH_SHORT).show();
                        m_iPreviewHandle = -1;

                    }
                }
            }
        });

        //get channel button click event
        Button buttonChannel = (Button)rootView.findViewById(R.id.button_get_channel);
        buttonChannel.setOnClickListener(new View.OnClickListener(){
            public void onClick(View view) {
                DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                if(deviceInfo == null){
                    Toast.makeText(m_mainActivity,"please login in first",Toast.LENGTH_SHORT).show();
                    return;
                }
                m_byChanNum = deviceInfo.m_struDeviceInfoV30_jni.byChanNum;
                m_byStartChan = deviceInfo.m_struDeviceInfoV30_jni.byStartChan;

                m_IPChanNum = deviceInfo.m_struDeviceInfoV30_jni.byIPChanNum + deviceInfo.m_struDeviceInfoV30_jni.byHighDChanNum * 256;
                m_byStartDChan = deviceInfo.m_struDeviceInfoV30_jni.byStartDChan ;

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
                m_arrchannel_adapter= new ArrayAdapter<String>(m_mainActivity, android.R.layout.simple_spinner_item, m_data_list_channel);
                m_arrchannel_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                m_bychannel_spinner.setAdapter(m_arrchannel_adapter);
            }
        });


        //start palyback button click event
        Button buttonStartPlayback = (Button)rootView.findViewById(R.id.button_playback_start);
        buttonStartPlayback.setOnClickListener(new View.OnClickListener(){
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        NET_DVR_TIME timeStart = new NET_DVR_TIME();
                        NET_DVR_TIME timeStop = new NET_DVR_TIME();

                        Calendar calStart = Calendar.getInstance();
                        Calendar calEnd = Calendar.getInstance();
                        calStart.setTime(getStartTime());
                        calEnd.setTime(getEndTime());

                        if(calEnd.compareTo(calStart) < 0) {
                            Toast.makeText(m_mainActivity,"The EndTime should larger than StartTime",Toast.LENGTH_SHORT).show();
                            return;
                        }
                        SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStart,calStart);
                        SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStop,calEnd);

                        NET_DVR_VOD_PARA vodParma = new NET_DVR_VOD_PARA();
                        vodParma.struBeginTime = timeStart;
                        vodParma.struEndTime = timeStop;
                        vodParma.byStreamType = (byte)m_iSelectStreamType;
                        vodParma.struIDInfo.dwChannel = m_iSelectChannel;
                        vodParma.hWnd = new Surface(surfacetexture);

                        if(m_iPlayBackID != -1){
                            Toast.makeText(m_mainActivity,"maybe plack back already,click stop button first   m_iPlayBackID:"
                                    + m_iPlayBackID,Toast.LENGTH_SHORT).show();
                            return;
                        }
                        m_iPlayBackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackByTime_v40_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,vodParma);
                        if(m_iPlayBackID < 0){
                            Toast.makeText(m_mainActivity,"play back failed, m_iPlayBackID:" +m_iPlayBackID
                                    + "error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                            return;
                        }
                    }
                }
                Toast.makeText(m_mainActivity,"NET_DVR_PlayBackByTime_V40 Succ  m_iPlayBackID:" + m_iPlayBackID,Toast.LENGTH_SHORT).show();
            }
        });


        //stop palyback button click event
        Button buttonStopPlayback = (Button)rootView.findViewById(R.id.button_playback_stop);
        buttonStopPlayback.setOnClickListener(new View.OnClickListener(){
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        if(m_iPlayBackID == -1){
                            Toast.makeText(m_mainActivity,"plack back first  m_iPlayBackID:" + m_iPlayBackID,Toast.LENGTH_SHORT).show();
                            return;
                        }
                        try{
                            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                            m_iPlayBackID = -1;
                        }finally {

                        }
                    }
                }
                Toast.makeText(m_mainActivity,"NET_DVR_StopPlayBack Succ m_iPlayBackID:" + m_iPlayBackID,Toast.LENGTH_SHORT).show();
            }
        });

        //stream spinner click event
        m_bystream_spinner= (Spinner) rootView.findViewById(R.id.stream_spinner);
        m_bychannel_spinner= (Spinner) rootView.findViewById(R.id.bychan_spinner);

        m_data_list_stream = new ArrayList<String>();
        m_data_list_stream.add("main_stream");
        m_data_list_stream.add("sub_stream");
        m_data_list_stream.add("third_stream");

        m_streamtype_adapter = new ArrayAdapter<String>(m_mainActivity, android.R.layout.simple_spinner_item, m_data_list_stream);
        m_streamtype_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        m_bystream_spinner.setAdapter(m_streamtype_adapter);


        m_bystream_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                m_iSelectStreamType = i;
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        m_bychannel_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                String text= m_bychannel_spinner.getItemAtPosition(i).toString();
                m_iSelectChannel = Integer.valueOf(GetChannel(text)).intValue();
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });


        return rootView;
    }

    public String GetChannel(String inPutStr) {

        String regEx="[^0-9]";
        Pattern p = Pattern.compile(regEx);
        Matcher m = p.matcher(inPutStr);
        return m.replaceAll("").trim();
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        return true;
    }

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture surface, int width,
                                          int height) {
        // TODO Auto-generated method stub
        //Log.i(TAG,"onSurfaceTextureAvailable");
        surfacetexture = surface;
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width,
                                            int height) {
        // TODO Auto-generated method stub

    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
        // TODO Auto-generated method stub
        return false;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture surface) {
        // TODO Auto-generated method stub

    }

    private static Date getStartTime() {
        Calendar todayStart = Calendar.getInstance();
        todayStart.set(Calendar.HOUR_OF_DAY, 0);
        todayStart.set(Calendar.MINUTE, 0);
        todayStart.set(Calendar.SECOND, 0);
        todayStart.set(Calendar.MILLISECOND, 0);
        return todayStart.getTime();
    }

    private static Date getEndTime() {
        Calendar todayEnd = Calendar.getInstance();
        todayEnd.set(Calendar.HOUR_OF_DAY, 23);
        todayEnd.set(Calendar.MINUTE, 59);
        todayEnd.set(Calendar.SECOND, 59);
        todayEnd.set(Calendar.MILLISECOND, 999);
        return todayEnd.getTime();
    }

    public static String getDateStr(Date date,String format) {
        if (format == null || format.isEmpty()) {
            format = "yyyy-MM-dd HH:mm:ss";
        }
        SimpleDateFormat formatter = new SimpleDateFormat(format);
        return formatter.format(date);
    }

    public static Date parseServerTime(String serverTime, String format) {
        if (format == null || format.isEmpty()) {
            format = "yyyy-MM-dd HH:mm:ss";
        }
        SimpleDateFormat sdf = new SimpleDateFormat(format, Locale.CHINESE);
        sdf.setTimeZone(TimeZone.getTimeZone("GMT+8:00"));
        Date date = null;
        try {
            date = sdf.parse(serverTime);
        } catch (Exception e) {
        }
        return date;
    }

}
