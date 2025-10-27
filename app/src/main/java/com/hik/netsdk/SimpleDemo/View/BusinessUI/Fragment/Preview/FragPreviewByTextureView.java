package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview;

import android.graphics.PixelFormat;
import android.graphics.SurfaceTexture;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.Surface;
import android.view.SurfaceHolder;
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
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;
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

public class FragPreviewByTextureView extends MyActivityBase implements TextureView.SurfaceTextureListener,SurfaceHolder.Callback {
    public static final String ARGS_PAGE = "args_page";
    private int mPage;
    private TextView textView;
    private TextureView m_oTextureView = null;
    private SurfaceTexture surfacetexture;
    private int m_iPreviewHandle = -1;
    private int m_iSelectChannel = -1;
    private int m_iSelectStreamType = -1;
    private int m_iUserID = -1; // return by NET_DVR_Login_v30

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


    @Nullable
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_frag_preview_textureview);

        findViewById(R.id.button_preview_start).setOnClickListener(new MyListener());
        findViewById(R.id.button_preview_stop).setOnClickListener(new MyListener());
        findViewById(R.id.button_playback_start).setOnClickListener(new MyListener());
        findViewById(R.id.button_playback_stop).setOnClickListener(new MyListener());

        //channel spinner
        m_bychannel_spinner = (Spinner) findViewById(R.id.bychan_spinner);

        //Channel type
        DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
        if (deviceInfo == null) {
            Toast.makeText(FragPreviewByTextureView.this, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
            return;
        }
        m_iUserID = deviceInfo.m_lUserID;
        m_byChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byChanNum;
        m_byStartChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan;

        m_IPChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byIPChanNum + deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byHighDChanNum  * 256;
        m_byStartDChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan;

        int iAnalogStartChan = m_byStartChan;
        int iDigitalStartChan = m_byStartDChan;
        m_data_list_channel = new ArrayList<String>();

        for (int idexChanNum = 0; idexChanNum < m_byChanNum; idexChanNum++) {
            m_data_list_channel.add("ACamera_" + iAnalogStartChan);
            iAnalogStartChan++;
        }

        for (int idexChanNum = 0; idexChanNum < m_IPChanNum; idexChanNum++) {

            m_data_list_channel.add("DCamera_" + iDigitalStartChan);
            iDigitalStartChan++;
        }
        m_arrchannel_adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, m_data_list_channel);
        m_arrchannel_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        m_bychannel_spinner.setAdapter(m_arrchannel_adapter);

        //stream spinner
        m_bystream_spinner = (Spinner) findViewById(R.id.stream_spinner);
        //stream Type
        m_data_list_stream = new ArrayList<String>();
        m_data_list_stream.add("main_stream");
        m_data_list_stream.add("sub_stream");
        m_data_list_stream.add("third_stream");
        m_streamtype_adapter = new ArrayAdapter<String>(FragPreviewByTextureView.this, android.R.layout.simple_spinner_item, m_data_list_stream);
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
        m_oTextureView = findViewById(R.id.textureView2);
        m_oTextureView.setSurfaceTextureListener(this);

        m_eStartTime = findViewById(R.id.Starttime_EditText);
        m_eStartTime.setText(getDateStr(getStartTime(), "yyyy-MM-dd HH:mm:ss"));
        m_eEndTime = findViewById(R.id.Endtime_EditText);
        m_eEndTime.setText(getDateStr(getEndTime(), "yyyy-MM-dd HH:mm:ss"));
    }

    @Override
    protected void onDestroy() {
        if(m_iPreviewHandle != -1){
            SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle);
            m_iPreviewHandle = -1;
        }

        if(m_iPlayBackID != -1){
            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
            m_iPlayBackID = -1;
        }

        super.onDestroy();
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

   // @Override
    public void onSurfaceTextureAvailable(SurfaceTexture surface, int width,
                                          int height) {
        // TODO Auto-generated method stub
        //Log.i(TAG,"onSurfaceTextureAvailable");
        surfacetexture = surface;
    }

   // @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width,
                                            int height) {
        // TODO Auto-generated method stub

    }

  //  @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
        // TODO Auto-generated method stub
        return false;
    }

    // @Override
    public void surfaceCreated(SurfaceHolder holder) {
//        m_oTextureView.getHolder().setFormat(PixelFormat.TRANSLUCENT);
        if (-1 == m_iPreviewHandle) {
            return;
        }
        Surface surface = holder.getSurface();
        if (surface.isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlaySurfaceChanged_jni(m_iPreviewHandle, 0, holder))
                Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
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
                Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_RealPlaySurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
        }
    }

    class MyListener implements View.OnClickListener{
        @Override
        public void onClick(View v) {
            switch (v.getId())
            {
                case R.id.button_preview_start:
                    if(m_iPreviewHandle != -1){
                        SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle);
                        m_iPreviewHandle = -1;
                    }
                    if (m_iUserID < 0)
                    {
                        Toast.makeText(FragPreviewByTextureView.this, "please login first", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    NET_DVR_PREVIEWINFO_V20 struPlayInfo = new NET_DVR_PREVIEWINFO_V20();
                    struPlayInfo.lChannel = m_iSelectChannel;
                    struPlayInfo.dwStreamType = m_iSelectStreamType;
                    struPlayInfo.hHwnd = new Surface(surfacetexture);
                    m_iPreviewHandle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(m_iUserID, struPlayInfo, null);
                    if (m_iPreviewHandle < 0)
                    {
                        Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_RealPlay_V40 fail, Err:"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_RealPlay_V40 Succ",Toast.LENGTH_SHORT).show();
                    m_oTextureView.setVisibility(View.VISIBLE);
                    break;
                case R.id.button_preview_stop:
                    if (!SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(m_iPreviewHandle))
                    {
                        Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_StopRealPlay fail, Err:" + SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_StopRealPlay Succ",Toast.LENGTH_SHORT).show();
                    m_iPreviewHandle = -1;
                    m_oTextureView.setVisibility(View.INVISIBLE);
                    break;

                case R.id.button_playback_start:
                    if(m_iUserID != -1)
                    {
                        NET_DVR_TIME timeStart = new NET_DVR_TIME();
                        NET_DVR_TIME timeStop = new NET_DVR_TIME();

                        Calendar calStart = Calendar.getInstance();
                        Calendar calEnd = Calendar.getInstance();
                        calStart.setTime(getStartTime());
                        calEnd.setTime(getEndTime());

                        if(calEnd.compareTo(calStart) < 0) {
                            Toast.makeText(FragPreviewByTextureView.this,"The EndTime should larger than StartTime",Toast.LENGTH_SHORT).show();
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
                            Toast.makeText(FragPreviewByTextureView.this,"maybe plack back already,click stop button first   m_iPlayBackID:"
                                    + m_iPlayBackID,Toast.LENGTH_SHORT).show();
                            return;
                        }
                        m_iPlayBackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackByTime_v40_jni(m_iUserID,vodParma);
                        if(m_iPlayBackID < 0){
                            Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_PlayBackByTime_V40 failed, Err:"+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                            return;
                        }
                    }
                    Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_PlayBackByTime_V40 Succ" ,Toast.LENGTH_SHORT).show();
                    m_oTextureView.setVisibility(View.VISIBLE);
                    break;
                case R.id.button_playback_stop:
                    if(m_iPlayBackID == -1){
                        Toast.makeText(FragPreviewByTextureView.this,"plack back first  m_iPlayBackID:" + m_iPlayBackID,Toast.LENGTH_SHORT).show();
                        return;
                    }

                    if (!SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID))
                    {
                        Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_StopPlayBack fail, Err:" + SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                        return;
                    }
                    Toast.makeText(FragPreviewByTextureView.this,"NET_DVR_StopPlayBack Succ",Toast.LENGTH_SHORT).show();
                    m_iPlayBackID = -1;
                    m_oTextureView.setVisibility(View.INVISIBLE);
                    break;
                default:
                    break;
            }
        }
    }

    public void onClick(View v) {
        switch (v.getId()) {
        }
    }

   // @Override
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
