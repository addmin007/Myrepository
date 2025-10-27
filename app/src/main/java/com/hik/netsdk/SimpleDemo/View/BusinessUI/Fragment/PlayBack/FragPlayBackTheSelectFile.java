package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack;


import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Message;
import android.support.annotation.NonNull;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.util.Log;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.Surface;
import android.view.View;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.Toast;
import android.widget.TextView;
import android.view.SurfaceHolder.Callback;
import org.MediaPlayer.PlayM4.Player;

import com.hcnetsdk.jna.HCNetSDKJNAInstance;
import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_DEVICEINFO_V30;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO;
import com.hikvision.netsdk.PlaybackControlCommand;
import com.hikvision.netsdk.NET_DVR_PLAYBACK_INFO;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/**
 * brief：select the file
 * author：hubinglun
 * date：2019/05/13
 */

public class FragPlayBackTheSelectFile extends MyActivityBase implements View.OnClickListener,Callback{

    public static final int DOWNLOAD_FINISH = 1;
    public static final int PLATBACK_EXCEPTION = 2;
    public static final int PLATBACK_FINISH= 3;
    public static final int PLATBACK_PROCESS = 4;
    public static final int DOWNLOAD_EXCEPTION = 5;
    final private int REQUEST_CODE_ASK_PERMISSIONS = 123;

    Button m_oDownloadBtn = null;
    private Lock m_lockPlayBack = new ReentrantLock(true);// Lock objects, use fair locks, otherwise the thread that gains progress will have a high probability of getting locks.
    private Lock m_lockDownLoad = new ReentrantLock(true);// Lock objects, use fair locks, otherwise the thread that gains progress will have a high probability of getting locks.
    private SurfaceView m_osurfaceView = null;
    private SeekBar m_seekBar = null;
    private TextView m_description  = null;
    private int m_iLogID = -1; // return by NET_DVR_Login_v30
    private int m_iPlayID = -1; // return by NET_DVR_RealPlay_V30
    private int m_iPlaybackID = -1; // return by NET_DVR_PlayBackByTime
    private int m_nDownloadHandle = -1;
    private int m_iPort = -1; // play port
    private int m_iStartChan = 0; // start channel no
    private int m_iChanNum = 0; // channel number
    private NET_DVR_DEVICEINFO_V30 m_oNetDvrDeviceInfoV30 = null;
    private int m_iProcess = 0;
    private String m_strFileName = "";
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_frag_play_back_the_select_file);

        DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
        if(deviceInfo == null){
            Toast.makeText(FragPlayBackTheSelectFile.this,"get the deviceInfo failed",Toast.LENGTH_SHORT).show();
            return;
        }
        m_iLogID = deviceInfo.m_lUserID;
        //Get the filename
        m_strFileName = getIntent().getStringExtra("FileName");
        findViewById(R.id.button_play).setOnClickListener(this);
        findViewById(R.id.button_reverse).setOnClickListener(this);
        findViewById(R.id.button_stop).setOnClickListener(this);
        //Download files on the same button to achieve two functions, download / stop Download
        m_oDownloadBtn = (Button)findViewById(R.id.button_download);
        m_oDownloadBtn.setOnClickListener(this);
        m_seekBar = (SeekBar) findViewById(R.id.seekBar);
        m_description =(TextView)findViewById(R.id.description);
        m_description.setVisibility(View.INVISIBLE);
        //Procrastination by Progress Bar
        m_seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            //Called when the drag bar stops dragging
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                m_iProcess = progress;
                m_description.setText("CurrentProgress:"+m_iProcess+"%");
            }

            //Called when the drag bar starts to drag
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                m_description.setVisibility(View.VISIBLE);
            }

            //Called when the drag bar stops dragging
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                if (m_iPlaybackID >= 0) {
                    byte[] lpInBuf = new byte[60];
                    lpInBuf[0] = (byte)m_iProcess;
                    //Toast.makeText(FragPlayBackTheSelectFile.this,"lpInBuf[0] = "+lpInBuf[0]+"lpInBuf[1] = "+lpInBuf[1]+"lpInBuf[2] = "+lpInBuf[2],Toast.LENGTH_SHORT).show();
                    NET_DVR_PLAYBACK_INFO struPlaybackInfo = null;
                    if(!SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackControl_V40_jni(m_iPlaybackID, 12, lpInBuf, 4, struPlaybackInfo)) {
                        Toast.makeText(FragPlayBackTheSelectFile.this,"change the process failed",Toast.LENGTH_SHORT).show();
                    }
                }
                m_description.setVisibility(View.INVISIBLE);
            }
        });
        m_osurfaceView = (SurfaceView) findViewById(R.id.Sur_Player);
        m_osurfaceView.getHolder().addCallback(this);
        // m_osurfaceView.setVisibility(View.VISIBLE);
        m_osurfaceView.setZOrderOnTop(true);
    }

    protected void onDestroy() {
        if(m_iPlaybackID != -1){
            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID);
        }
        super.onDestroy();
    }

    private Handler hander = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch(msg.what){
                case DOWNLOAD_FINISH:
                    m_oDownloadBtn.setText("Download");
                    Toast.makeText(FragPlayBackTheSelectFile.this,"download finish",Toast.LENGTH_SHORT).show();
                    break;
                case PLATBACK_EXCEPTION:
                    Toast.makeText(FragPlayBackTheSelectFile.this,"playback abnormal termination,error="+msg.arg1,Toast.LENGTH_SHORT).show();
                    break;
                case PLATBACK_FINISH:
                    m_seekBar.setProgress(msg.arg1);
                    Toast.makeText(FragPlayBackTheSelectFile.this,"playback by time over",Toast.LENGTH_SHORT).show();
                    break;
                case PLATBACK_PROCESS:
                    m_seekBar.setProgress(msg.arg1);
                    break;
                case DOWNLOAD_EXCEPTION:
                    Toast.makeText(FragPlayBackTheSelectFile.this,"download termination,error="+msg.arg1,Toast.LENGTH_SHORT).show();
                    break;
                default:
                    break;
            }
        }
    };
    @Override
    public void onClick(View v) {
        switch (v.getId()) {
            case R.id.button_play:

                if (m_iLogID < 0) {
                    Toast.makeText(FragPlayBackTheSelectFile.this,"please login on a device first",Toast.LENGTH_SHORT).show();
                    return;
                }
                if(m_iPlaybackID != -1){
                    Toast.makeText(FragPlayBackTheSelectFile.this,"maybe plack back already,click stop button first",Toast.LENGTH_SHORT).show();
                    return;
                }

                m_iPlaybackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackByName_jni(m_iLogID,m_strFileName, m_osurfaceView.getHolder().getSurface());

                if(m_iPlaybackID < 0){
                    Toast.makeText(FragPlayBackTheSelectFile.this,"play back failed,error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }
                Thread threadProcess = new Thread() {
                    public void run() {
                        m_iProcess = -1;
                        while (true) {
                            try {
                                //There is less than 0, it stops playing, but it needs to be locked.
                                m_lockPlayBack.lock();
                                if (m_iPlaybackID < 0) {
                                    break;
                                }
                                m_iProcess = SDKGuider.g_sdkGuider.m_comPBGuider.GetPlayBackPos_jni(m_iPlaybackID);
                                if (m_iProcess < 0 || m_iProcess > 100) {
                                    int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID);
                                    m_iPlaybackID = -1;
                                    Message msg = new Message();
                                    msg.what = PLATBACK_EXCEPTION;
                                    msg.arg1 = iError;
                                    hander.sendMessage(msg);
                                    break;
                                } else if (m_iProcess == 100) {
                                    SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID);
                                    m_iPlaybackID = -1;
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
                            } finally {
                                m_lockPlayBack.unlock();
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
            case R.id.button_reverse:

                if (m_iLogID < 0) {
                    Toast.makeText(FragPlayBackTheSelectFile.this,"please login on a device first",Toast.LENGTH_SHORT).show();
                    return;
                }
                if(m_iPlaybackID != -1){
                    Toast.makeText(FragPlayBackTheSelectFile.this,"maybe plack back already,click stop button first",Toast.LENGTH_SHORT).show();
                    return;
                }

                m_iPlaybackID = SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackReverseByName_jni(m_iLogID,m_strFileName, m_osurfaceView.getHolder().getSurface());
                if(m_iPlaybackID < 0){
                    Toast.makeText(FragPlayBackTheSelectFile.this,"play back failed,error="+SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
                    return;
                }

                Thread threadProcessReverse = new Thread() {
                            public void run() {
                                m_iProcess = -1;
                                while (true) {
                                    //There is less than 0, it stops playing, but it needs to be locked.
                                    try {
                                        //There is less than 0, stop playing, but need to lock, otherwise it may be - 1, call to get progress interface, return error code 12.
                                        m_lockPlayBack.lock();
                                        if (m_iPlaybackID < 0) {
                                            break;
                                        }
                                        m_iProcess = SDKGuider.g_sdkGuider.m_comPBGuider.GetPlayBackPos_jni(m_iPlaybackID);
                                        if (m_iProcess < 0 || m_iProcess > 100) {
                                            int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID);
                                            m_iPlaybackID = -1;
                                            Message msg = new Message();
                                            msg.what = PLATBACK_EXCEPTION;
                                            msg.arg1 = iError;
                                            hander.sendMessage(msg);
                                            break;
                                        } else if (m_iProcess == 0) {
                                            SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID);
                                            m_iPlaybackID = -1;
                                            Message msg = new Message();
                                            msg.what = PLATBACK_FINISH;
                                            hander.sendMessage(msg);
                                            break;
                                        } else {
                                            Message msg = new Message();
                                            msg.what = PLATBACK_PROCESS;
                                            msg.arg1 = m_iProcess;
                                            hander.sendMessage(msg);
                                        }
                                    }finally {
                                        m_lockPlayBack.unlock();
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

            case R.id.button_stop:
                if(m_iPlaybackID == -1){
                    Toast.makeText(FragPlayBackTheSelectFile.this,"plack back first",Toast.LENGTH_SHORT).show();
                    return;
                }
                try{
                    m_lockPlayBack.lock();
                    if (!SDKGuider.g_sdkGuider.m_comPBGuider.StopPlayBack_jni(m_iPlaybackID)) {
                        Toast.makeText(FragPlayBackTheSelectFile.this,"stop playback failed",Toast.LENGTH_SHORT).show();
                    } // player stop play
                    m_iPlaybackID = -1;
                    m_seekBar.setProgress(0);
                    m_iProcess = -1;
                }finally{
                    m_lockPlayBack.unlock();
                }
                break;
            case R.id.button_download:
                if (m_iLogID < 0) {
                    Toast.makeText(FragPlayBackTheSelectFile.this,"please login first",Toast.LENGTH_SHORT).show();
                    return;
                }else {
                    //If not - 1, it is already downloaded, which will stop downloading, and the button will be downloaded.
                    if(m_nDownloadHandle != -1){
                        try{
                            m_lockDownLoad.lock();
                            SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_nDownloadHandle);
                            m_nDownloadHandle = -1;
                            m_oDownloadBtn.setText("Download");
                            Toast.makeText(FragPlayBackTheSelectFile.this,"stop download the file",Toast.LENGTH_SHORT).show();
                        }finally {
                            m_lockDownLoad.unlock();
                        }
                        return;
                    }
                    Date now =new Date();
                    SimpleDateFormat sdf=new SimpleDateFormat("yyyyMMddhhssmm");
                    String strFileName = sdf.format(now);
                    m_nDownloadHandle = SDKGuider.g_sdkGuider.m_comPBGuider.GetFileByName_jni(m_iLogID,m_strFileName, new String("/mnt/sdcard/download/"+strFileName+".mp4"));
                    if(m_nDownloadHandle == -1){
                        Toast.makeText(FragPlayBackTheSelectFile.this,"download failed,Error="+ HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_SHORT).show();
                    }else{
                        //Stop downloading while downloading the button. Set the button to stop downloading after downloading.
                        m_oDownloadBtn.setText("StopDownload");
                        Thread threadDownloadProcess = new Thread() {
                            public void run() {
                                int nProgress = -1;
                                while (true) {
                                    try {
                                        //Here is less than 0, is to stop downloading, but need to lock, otherwise it may be - 1, call to get progress interface, return error code 12
                                        m_lockDownLoad.lock();
                                        if (m_nDownloadHandle < 0) {
                                            break;
                                        }
                                        nProgress = SDKGuider.g_sdkGuider.m_comPBGuider.GetDownloadPos_jni(m_nDownloadHandle);
                                        if (nProgress < 0 || nProgress > 100) {
                                            int iError = SDKGuider.g_sdkGuider.GetLastError_jni();
                                            SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_nDownloadHandle);
                                            m_nDownloadHandle = -1;

                                            Message msg = new Message();
                                            msg.what = DOWNLOAD_EXCEPTION;
                                            msg.arg1 = iError;
                                            hander.sendMessage(msg);
                                            break;
                                        } else if (nProgress == 100) {
                                            SDKGuider.g_sdkGuider.m_comPBGuider.StopGetFile_jni(m_nDownloadHandle);
                                            m_nDownloadHandle = -1;

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
                    }
                }
                break;
        }
    }

    @Override
    public void surfaceCreated(SurfaceHolder holder) {

        m_osurfaceView.getHolder().setFormat(PixelFormat.TRANSLUCENT);
        if (-1 == m_iPlaybackID) {
            return;
        }
        Surface surface = holder.getSurface();
        if (surface.isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackSurfaceChanged_jni(m_iPlaybackID, 0, holder))
            {
                Toast.makeText(FragPlayBackTheSelectFile.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
        }
    }

    // @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width,
                               int height) {
        //Toast.makeText(FragPlayBackTheSelectFile.this,"surfaceChanged" + m_iPort ,Toast.LENGTH_SHORT).show();
    }

    // @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        if (-1 == m_iPlaybackID) {
            return;
        }
        if (holder.getSurface().isValid()) {
            if (-1 == SDKGuider.g_sdkGuider.m_comPBGuider.PlayBackSurfaceChanged_jni(m_iPlaybackID, 0, null))
            {
                Toast.makeText(FragPlayBackTheSelectFile.this,"NET_DVR_PlayBackSurfaceChanged"+ SDKGuider.g_sdkGuider.GetLastError_jni(),Toast.LENGTH_SHORT).show();
            }
        }
    }
}
