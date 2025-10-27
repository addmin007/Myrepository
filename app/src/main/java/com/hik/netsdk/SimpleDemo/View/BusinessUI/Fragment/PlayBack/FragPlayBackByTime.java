package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack;

import android.graphics.PixelFormat;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.datepicker.CustomDatePicker;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.datepicker.DateFormatUtils;

import com.hik.netsdk.SimpleDemo.View.MyActivityBase;

import com.hikvision.netsdk.NET_DVR_DEVICEINFO_V30;
import com.hikvision.netsdk.NET_DVR_PLAYCOND;

import com.hikvision.netsdk.NET_DVR_TIME;
import com.hikvision.netsdk.NET_DVR_VOD_PARA;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * brief：play back by time
 * author：hubinglun
 * date：2019/05/13
 */

public class FragPlayBackByTime extends MyActivityBase implements View.OnClickListener,SurfaceHolder.Callback {
    public static final int PLATBACK_EXCEPTION = 1;
    public static final int PLATBACK_FINISH = 2;
    public static final int PLATBACK_PROCESS = 3;

    public static final int DOWNLOAD_EXCEPTION = 4;
    public static final int DOWNLOAD_FINISH = 5;

    private Lock m_lockPlayBack = new ReentrantLock(true);// Lock objects, use fair locks, otherwise the thread that gains progress will have a high probability of getting locks.
    private Lock m_lockDownLoad = new ReentrantLock(true);// Lock objects, use fair locks, otherwise the thread that gains progress will have a high probability of getting locks.

    private SurfaceView m_osurfaceView = null;
    private List<String> m_data_list_channel,m_data_list_stream;
    private Spinner m_bychannel_spinner,m_bystream_spinner;
    private ArrayAdapter<String> m_arrchannel_adapter,m_arrstream_adapter;
    private TextView m_TvSelectedStartTime, m_TvSelectedEndTime;
    private CustomDatePicker m_BeginTimerPicker; //mEndTimerPicker;
    private SeekBar m_seekBar = null;
    private boolean m_bSelectBegin = false;

    private int m_iFindHandle = -1;
    private int m_iUserID = -1; // return by NET_DVR_Login_v30
    private int m_iPlayBackID = -1;
    private int m_iDownloadHandle = -1;
    private int m_iPort = -1; // play port
    private int m_iProcess = 0;
    private int m_byChanNum = 0;
    private int m_byStartChan = 0;

    private int m_IPChanNum = 0;
    private int m_byStartDChan = 0;

    private int m_iSelectChannel = -1;
    private int m_iSelectStreamType = -1;
    private Button m_oDownloadBtn = null;
    private TextView m_description  = null;
    private NET_DVR_DEVICEINFO_V30 m_oNetDvrDeviceInfoV30 = null;
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_frag_play_back_by_time);

        findViewById(R.id.button_bytime_play).setOnClickListener(this);
        findViewById(R.id.button_bytime_reverse).setOnClickListener(this);
        findViewById(R.id.button_bytime_stop).setOnClickListener(this);
        //Download files on the same button to achieve two functions, download / stop Download
        m_oDownloadBtn = (Button) findViewById(R.id.button_bytime_download);
        m_oDownloadBtn.setOnClickListener(this);

        m_bychannel_spinner = (Spinner) findViewById(R.id.bytime_spinner);
        m_bystream_spinner= (Spinner) findViewById(R.id.stream_spinner);

        //Channel Number Related Acquisition and Display
        DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
        if(deviceInfo == null){
            Toast.makeText(FragPlayBackByTime.this,"get the deviceInfo failed",Toast.LENGTH_SHORT).show();
            return;
        }
        m_iUserID = deviceInfo.m_lUserID;
        m_byChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byChanNum;
        m_byStartChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan;

        m_IPChanNum = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byIPChanNum + deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byHighDChanNum * 256;
        m_byStartDChan = deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byStartDChan ;

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

        m_data_list_stream = new ArrayList<String>();
        m_data_list_stream.add("main_stream");
        m_data_list_stream.add("sub_stream");
        m_data_list_stream.add("third_stream");

        m_arrstream_adapter= new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, m_data_list_stream);
        m_arrstream_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        m_bystream_spinner.setAdapter(m_arrstream_adapter);
        //spinner click event
        m_bychannel_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {//通过此方法为下拉列表设置点击事件
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                //Triggered here when the camera channel is selected
                String text= m_bychannel_spinner.getItemAtPosition(i).toString();
                m_iSelectChannel = Integer.valueOf(GetChannel(text)).intValue();
                //Toast.makeText(FragPlayBackByTime.this,text+"i = "+m_iSelectChannel,Toast.LENGTH_SHORT).show();
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        m_bystream_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            //Set click events for the drop-down list by this method
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                //Triggered here when selecting the primary and substream types
                m_iSelectStreamType = i;
            }

            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        m_seekBar = (SeekBar) findViewById(R.id.seekBar);
        m_description =(TextView)findViewById(R.id.description);
        m_description.setVisibility(View.INVISIBLE);
        //Procrastination by Progress Bar
        m_seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {

            //Called when the drag bar stops dragging
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {

                m_description.setText("CurrentProgress："+progress+"%");
            }

            //Called when the drag bar starts to drag
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                m_description.setVisibility(View.VISIBLE);
            }

            // Called when the drag bar stops dragging
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                m_seekBar.setProgress(m_iProcess);
                m_description.setVisibility(View.INVISIBLE);
            }
        });

        m_osurfaceView = (SurfaceView) findViewById(R.id.Sur_bytime_Player);
        m_osurfaceView.getHolder().addCallback(this);
        m_osurfaceView.setZOrderOnTop(true);

        findViewById(R.id.ll_bytime_start_time).setOnClickListener(this);
        m_TvSelectedStartTime = findViewById(R.id.tv_bytime_selected_date);

        findViewById(R.id.ll_bytime_end_time).setOnClickListener(this);
        m_TvSelectedEndTime = findViewById(R.id.tv_bytime_selected_time);

        initBeginTimerPicker();
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
        if (-1 == m_iPlayBackID) {
            return;
        }
        Surface surface = holder.getSurface();
        if (surface.isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackSurfaceChanged_jni(m_iPlayBackID, 0, holder))
            {
                Toast.makeText(FragPlayBackByTime.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
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
        if (-1 == m_iPlayBackID) {
            return;
        }
        if (holder.getSurface().isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackSurfaceChanged_jni(m_iPlayBackID, 0, null))
            {
                Toast.makeText(FragPlayBackByTime.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void initBeginTimerPicker() {
        String beginTime = "1990-10-17 00:00:00";
        String endTime = DateFormatUtils.long2Str(System.currentTimeMillis(), true);
        m_TvSelectedStartTime.setText(DateFormatUtils.long2Str(System.currentTimeMillis(), false)+" 00:00:00");
        m_TvSelectedEndTime.setText(endTime);
        //yyyy-MM-dd HH:mm
        m_BeginTimerPicker = new CustomDatePicker(this, new CustomDatePicker.Callback() {
            @Override
            public void onTimeSelected(long timestamp) {
                if(m_bSelectBegin){
                    m_TvSelectedStartTime.setText(DateFormatUtils.long2Str(timestamp, true));
                }else{
                    m_TvSelectedEndTime.setText(DateFormatUtils.long2Str(timestamp, true));
                }

            }
        }, beginTime, endTime);
        m_BeginTimerPicker.setCancelable(true);
        m_BeginTimerPicker.setCanShowPreciseTime(true);
        m_BeginTimerPicker.setScrollLoop(true);
        m_BeginTimerPicker.setCanShowAnim(true);
    }

    @Override
    protected void onDestroy() {
        if(m_iPlayBackID != -1){
            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
            m_iPlayBackID = -1;
        }
        super.onDestroy();
        m_BeginTimerPicker.onDestroy();
    }

    private Handler hander = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch(msg.what){
                case PLATBACK_EXCEPTION:
                    Toast.makeText(FragPlayBackByTime.this,"playback abnormal termination,error="+msg.arg1,Toast.LENGTH_SHORT).show();
                    break;
                case PLATBACK_FINISH:
                    m_seekBar.setProgress(msg.arg1);
                    Toast.makeText(FragPlayBackByTime.this,"playback by time over",Toast.LENGTH_SHORT).show();
                    break;
                case PLATBACK_PROCESS:
                    m_seekBar.setProgress(msg.arg1);
                    break;
                case DOWNLOAD_EXCEPTION:
                    Toast.makeText(FragPlayBackByTime.this,"download termination,error="+msg.arg1,Toast.LENGTH_SHORT).show();
                    break;
                case DOWNLOAD_FINISH:
                    m_oDownloadBtn.setText("Download");
                    Toast.makeText(FragPlayBackByTime.this,"download by time over",Toast.LENGTH_SHORT).show();
                    break;
                default:
                    break;
            }
        }
    };
    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.ll_bytime_start_time:
                m_bSelectBegin = true;
                //yyyy-MM-dd HH:mm:ss
                m_BeginTimerPicker.show(m_TvSelectedStartTime.getText().toString());
                //Toast.makeText(PlayBackByFile.this,mTvSelectedStartTime.getText().toString(),Toast.LENGTH_SHORT).show();
                break;

            case R.id.ll_bytime_end_time:
                m_bSelectBegin = false;
                //yyyy-MM-dd HH:mm:ss
                m_BeginTimerPicker.show(m_TvSelectedEndTime.getText().toString());
                //Toast.makeText(PlayBackByFile.this,m_TvSelectedEndTime.getText().toString(),Toast.LENGTH_SHORT).show();
                break;

            case R.id.button_bytime_play:
                NET_DVR_TIME timeStart = new NET_DVR_TIME();
                NET_DVR_TIME timeStop = new NET_DVR_TIME();

                Date startDateFormat = null;
                Date endDateFormat = null;
                try {
                    startDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedStartTime.getText().toString());
                    endDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedEndTime.getText().toString());
                } catch (ParseException e) {
                    e.printStackTrace();
                }
                //The date type-related getyear interface is no longer in use, so it will be converted to CalenDar for date
                Calendar calStart = Calendar.getInstance();
                Calendar calEnd = Calendar.getInstance();
                calStart.setTime(startDateFormat);
                calEnd.setTime(endDateFormat);

                //Compare the size of the time, the end time is greater than the start time before the search.
                if(calEnd.compareTo(calStart) < 0) {
                    Toast.makeText(FragPlayBackByTime.this,"The EndTime should larger than StartTime",Toast.LENGTH_SHORT).show();
                    return;
                }
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStart,calStart);
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStop,calEnd);

                NET_DVR_VOD_PARA vodParma = new NET_DVR_VOD_PARA();
                vodParma.struBeginTime = timeStart;
                vodParma.struEndTime = timeStop;
                vodParma.byStreamType = (byte)m_iSelectStreamType;
                vodParma.struIDInfo.dwChannel = m_iSelectChannel;
                vodParma.hWnd = m_osurfaceView.getHolder().getSurface();

                //m_iPlayBackID = HCNetSDK.getInstance().NET_DVR_PlayBackByTime_V40(m_iUserID, vodParma);
                if(m_iPlayBackID != -1){
                    Toast.makeText(FragPlayBackByTime.this,"maybe plack back already,click stop button first",Toast.LENGTH_SHORT).show();
                    return;
                }
                m_iPlayBackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackByTime_v40_jni(m_iUserID,vodParma);
                if(m_iPlayBackID < 0){
                    Toast.makeText(FragPlayBackByTime.this,"play back failed,error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Thread threadProcess = new Thread() {
                    public void run() {
                        m_iProcess = -1;
                        while (true) {
                            try {
                                //There is less than 0, it stops playing, but it needs to be locked.
                                m_lockPlayBack.lock();// Get Locked
                                if (m_iPlayBackID < 0) {
                                    break;
                                }
                                m_iProcess = SDKGuider.g_sdkGuider.m_comPBGuider.GetPlayBackPos_jni(m_iPlayBackID);
                                if (m_iProcess < 0 || m_iProcess > 100) {
                                    int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                                    m_iPlayBackID = -1;
                                    Message msg = new Message();
                                    msg.what = PLATBACK_EXCEPTION;
                                    msg.arg1 = iError;
                                    hander.sendMessage(msg);
                                    break;
                                } else if (m_iProcess == 100) {
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                                    m_iPlayBackID = -1;
                                    Message msg = new Message();
                                    msg.what = PLATBACK_FINISH;
                                    msg.arg1 = m_iProcess;
                                    hander.sendMessage(msg);
                                    break;
                                } else {
                                    Message msg = new Message();
                                    msg.what = PLATBACK_PROCESS;
                                    msg.arg1 = m_iProcess;
                                    hander.sendMessage(msg);

                                }
                            }finally {
                                m_lockPlayBack.unlock();// Release lock
                                try {
                                    Thread.sleep(1000);
                                } catch (InterruptedException e) {
                                    e.printStackTrace();
                                }
                            }
                        }
                    }
                };
                threadProcess.start();
                break;

            case R.id.button_bytime_reverse:
                NET_DVR_TIME timeStartReverse = new NET_DVR_TIME();
                NET_DVR_TIME timeStopReverse = new NET_DVR_TIME();

                Date startDateFormatReverse = null;
                Date endDateFormatReverse = null;
                try {
                    startDateFormatReverse = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedStartTime.getText().toString());
                    endDateFormatReverse = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedEndTime.getText().toString());
                } catch (ParseException e) {
                    e.printStackTrace();
                }
                //The date type-related getyear interface is no longer in use, so it will be converted to CalenDar for date
                Calendar calStartReverse = Calendar.getInstance();
                Calendar calEndReverse = Calendar.getInstance();
                calStartReverse.setTime(startDateFormatReverse);
                calEndReverse.setTime(endDateFormatReverse);

                //Compare the size of the time, the end time is greater than the start time before the search.
                if(calEndReverse.compareTo(calStartReverse) < 0) {
                    Toast.makeText(FragPlayBackByTime.this,"The EndTime should larger than StartTime",Toast.LENGTH_SHORT).show();
                    return;
                }
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStartReverse,calStartReverse);
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStopReverse,calEndReverse);

                NET_DVR_PLAYCOND vodParmaReverse = new NET_DVR_PLAYCOND();
                vodParmaReverse.struStartTime = timeStartReverse;
                vodParmaReverse.struStopTime = timeStopReverse;
                vodParmaReverse.byStreamType = (byte)m_iSelectStreamType;
                vodParmaReverse.dwChannel = m_iSelectChannel;
                Surface surWnd = m_osurfaceView.getHolder().getSurface();

                //m_iPlayBackID = HCNetSDK.getInstance().NET_DVR_PlayBackReverseByTime_V40(m_iUserID, surWnd, vodParmaReverse);
                if(m_iPlayBackID != -1){
                    Toast.makeText(FragPlayBackByTime.this,"maybe plack back already,click stop button first",Toast.LENGTH_SHORT).show();
                    return;
                }
                m_iPlayBackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackReverseByTime_V40_jni(m_iUserID, surWnd, vodParmaReverse);
                if(m_iPlayBackID < 0){
                    Toast.makeText(FragPlayBackByTime.this,"play back failed,error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Thread threadProcessReverse = new Thread() {
                    public void run() {
                        m_iProcess = -1;
                        while (true) {
                            try {
                                //There is less than 0, it stops playing, but it needs to be locked.
                                m_lockPlayBack.lock();// get locked
                                if (m_iPlayBackID < 0) {
                                    break;
                                }
                                m_iProcess = SDKGuider.g_sdkGuider.m_comPBGuider.GetPlayBackPos_jni(m_iPlayBackID);
                                if (m_iProcess < 0 || m_iProcess > 100) {
                                    int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                                    m_iPlayBackID = -1;

                                    Message msg = new Message();
                                    msg.what = PLATBACK_EXCEPTION;
                                    msg.arg1 = iError;
                                    hander.sendMessage(msg);

                                    break;
                                } else if (m_iProcess == 0) {
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                                    m_iPlayBackID = -1;

                                    Message msg = new Message();
                                    msg.what = PLATBACK_FINISH;
                                    msg.arg1 = m_iProcess;
                                    hander.sendMessage(msg);
                                    break;
                                } else {
                                    Message msg = new Message();
                                    msg.what = PLATBACK_PROCESS;
                                    msg.arg1 = m_iProcess;
                                    hander.sendMessage(msg);
                                }
                            }finally {
                                m_lockPlayBack.unlock();// Release lock
                                try {
                                    Thread.sleep(1000);
                                } catch (InterruptedException e) {
                                    e.printStackTrace();
                                }
                            }
                        }
                    }
                };
                threadProcessReverse.start();
                break;

            case R.id.button_bytime_stop:
                if(m_iPlayBackID == -1){
                    Toast.makeText(FragPlayBackByTime.this,"plack back first",Toast.LENGTH_SHORT).show();
                    return;
                }
                try{
                    m_lockPlayBack.lock();// get locked
                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlayBackID);
                    m_iProcess = 0;
                    m_seekBar.setProgress(m_iProcess);
                    m_iPlayBackID = -1;
                }finally {
                    m_lockPlayBack.unlock();
                }

                break;
            case R.id.button_bytime_download:
                if(m_iDownloadHandle != -1){
                    try{
                        m_lockDownLoad.lock();// get locked
                        SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_iDownloadHandle);
                        m_iDownloadHandle = -1;
                        m_oDownloadBtn.setText("Download");
                        Toast.makeText(FragPlayBackByTime.this,"stop download the video",Toast.LENGTH_SHORT).show();
                    }finally {
                        m_lockDownLoad.unlock();// Release lock
                    }
                    return;
                }

                NET_DVR_TIME timeStartDownload = new NET_DVR_TIME();
                NET_DVR_TIME timeStopDownload = new NET_DVR_TIME();

                Date startDateFormatDownload = null;
                Date endDateFormatDownload = null;
                try {
                    startDateFormatDownload = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedStartTime.getText().toString());
                    endDateFormatDownload = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.CHINA).parse(m_TvSelectedEndTime.getText().toString());
                } catch (ParseException e) {
                    e.printStackTrace();
                }
                //The date type-related getyear interface is no longer in use, so it will be converted to CalenDar for date
                Calendar calStartDownload = Calendar.getInstance();
                Calendar calEndDownload = Calendar.getInstance();
                calStartDownload.setTime(startDateFormatDownload);
                calEndDownload.setTime(endDateFormatDownload);

                //Compare the size of the time, the end time is greater than the start time before the search.
                if(calEndDownload.compareTo(calStartDownload) < 0) {
                    Toast.makeText(FragPlayBackByTime.this,"The EndTime should larger than StartTime",Toast.LENGTH_SHORT).show();
                    return;
                }
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStartDownload,calStartDownload);
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStopDownload,calEndDownload);

                //int nDownloadHandle = HCNetSDK.getInstance().NET_DVR_GetFileByTime(m_iUserID,m_iSelectChannel, timeStartDownload, timeStopDownload, new String("/sdcard/RecordFile"));
                Date now =new Date();
                SimpleDateFormat sdf=new SimpleDateFormat("yyyyMMddhhssmm");
                String strFileName = sdf.format(now);

                m_iDownloadHandle = SDKGuider.g_sdkGuider.m_comPBGuider.GetFileByTime_jni(m_iUserID,m_iSelectChannel, timeStartDownload, timeStopDownload, new String("/mnt/sdcard/download/"+strFileName+".mp4"));

                if(m_iDownloadHandle < 0){
                    Toast.makeText(FragPlayBackByTime.this,"download failed,error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                m_oDownloadBtn.setText("StopDownload");
                Toast.makeText(FragPlayBackByTime.this,"is downloading now",Toast.LENGTH_SHORT).show();
                Thread threadDownloadProcess = new Thread() {
                    public void run() {
                        int nProgress = -1;
                        while (true) {
                            try {
                                //Here is less than 0, is to stop downloading, but need to lock, otherwise it may be - 1, call to get progress interface, return error code 12
                                m_lockDownLoad.lock();
                                if (m_iDownloadHandle < 0) {
                                    break;
                                }
                                nProgress = SDKGuider.g_sdkGuider.m_comPBGuider.GetDownloadPos_jni(m_iDownloadHandle);
                                if (nProgress < 0 || nProgress > 100) {
                                    int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_iDownloadHandle);
                                    m_iDownloadHandle = -1;

                                    Message msg = new Message();
                                    msg.what = DOWNLOAD_EXCEPTION;
                                    msg.arg1 = iError;
                                    hander.sendMessage(msg);
                                    break;
                                } else if (nProgress == 100) {
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_iDownloadHandle);
                                    m_iDownloadHandle = -1;

                                    Message msg = new Message();
                                    msg.what = DOWNLOAD_FINISH;
                                    hander.sendMessage(msg);
                                    break;
                                }

                            }finally {
                                m_lockDownLoad.unlock();
                                try {
                                    Thread.sleep(1000);
                                } catch (InterruptedException e) {
                                    e.printStackTrace();
                                }
                            }
                        }
                    }
                };
                threadDownloadProcess.start();
                break;
        }
    }
}
