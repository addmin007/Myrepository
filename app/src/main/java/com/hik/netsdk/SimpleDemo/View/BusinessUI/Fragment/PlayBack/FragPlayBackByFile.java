package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.telephony.mbms.FileInfo;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.datepicker.CustomDatePicker;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.datepicker.DateFormatUtils;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_FILECOND;
import com.hikvision.netsdk.NET_DVR_FINDDATA_V30;
import com.hikvision.netsdk.NET_DVR_TIME;
import com.hikvision.netsdk.NET_DVR_VOD_PARA;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * brief：play back by file
 * author：hubinglun
 * date：2019/05/13
 */

public class FragPlayBackByFile extends MyActivityBase implements View.OnClickListener{

        private List<FileInfo> m_fileInfoList = new ArrayList<>();
        private List<String> m_data_list_channel;
        private Spinner m_bychannel_spinner;
        private ArrayAdapter<String> arr_adapter;
        private TextView m_TvSelectedStartTime, m_TvSelectedEndTime;
        private CustomDatePicker m_BeginTimerPicker; //mEndTimerPicker;
        private ListView m_listView;
        private boolean m_bSelectBegin = false;
        private int m_iUserID = -1;
        private int m_iFindHandle = -1;
        private int m_byChanNum = 0;
        private int m_byStartChan = 0;

        private int m_IPChanNum = 0;
        private int m_byStartDChan = 0;
        private int m_iSelectChannel = -1;
        FileAdapter m_adapter;
        @Override
        public void onCreate (Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_frag_play_back_by_file);
            m_bychannel_spinner = (Spinner) findViewById(R.id.spinner);

            //Channel Number Related Acquisition and Display
            DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
            if(deviceInfo == null){
                Toast.makeText(FragPlayBackByFile.this,"get the deviceInfo failed",Toast.LENGTH_SHORT).show();
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
        //Adapter
        arr_adapter = new ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, m_data_list_channel);
        //Setting Styles
        arr_adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        //Load adapter
            m_bychannel_spinner.setAdapter(arr_adapter);
        //spinner Click Events
            m_bychannel_spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {//通过此方法为下拉列表设置点击事件
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                //Triggered here when the camera channel is selected
                String text= m_bychannel_spinner.getItemAtPosition(i).toString();
                m_iSelectChannel = Integer.valueOf(GetChannel(text)).intValue();
            }

            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });


        m_listView = (ListView) findViewById(R.id.list_view);
        //listview Click Events
        m_listView.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                FileInfo dataTemp = m_fileInfoList.get(position);
                //Toast.makeText(FragPlayBackByFile.this,dataTemp.fileIndex+dataTemp.getFileName(),Toast.LENGTH_SHORT).show();
                //This place implements jumping to the playback file interface, so all information needs to be passed here to the next activity.
                String fileName = dataTemp.getFileName();
                Intent intentPlayBackTheSelectFile = new Intent(FragPlayBackByFile.this, FragPlayBackTheSelectFile.class);
                intentPlayBackTheSelectFile.putExtra("FileName",fileName);
                startActivity(intentPlayBackTheSelectFile);
            }
        });

        findViewById(R.id.ll_start_time).setOnClickListener(this);
        m_TvSelectedStartTime = findViewById(R.id.tv_selected_date);

        findViewById(R.id.ll_end_time).setOnClickListener(this);
        m_TvSelectedEndTime = findViewById(R.id.tv_selected_time);

        initBeginTimerPicker();
        //initEndTimerPicker();

        findViewById(R.id.button_search).setOnClickListener(this);

        if (!HCNetSDK.getInstance().NET_DVR_Init()) {
            Toast.makeText(FragPlayBackByFile.this, "NET_DVR_Init fail", Toast.LENGTH_SHORT).show();
        }
    }

    public String GetChannel(String inPutStr) {

        String regEx="[^0-9]";
        Pattern p = Pattern.compile(regEx);
        Matcher m = p.matcher(inPutStr);
        return m.replaceAll("").trim();

    }
        private void initBeginTimerPicker () {
        String beginTime = "1990-10-17 00:00:00";
        String endTime = DateFormatUtils.long2Str(System.currentTimeMillis(), true);
        m_TvSelectedStartTime.setText(DateFormatUtils.long2Str(System.currentTimeMillis(), false) + " 00:00:00");
        m_TvSelectedEndTime.setText(endTime);
        // Initialize date by date string, format please use：yyyy-MM-dd HH:mm
        m_BeginTimerPicker = new CustomDatePicker(this, new CustomDatePicker.Callback() {
            @Override
            public void onTimeSelected(long timestamp) {
                if (m_bSelectBegin) {
                    m_TvSelectedStartTime.setText(DateFormatUtils.long2Str(timestamp, true));
                } else {
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
        protected void onDestroy () {
        super.onDestroy();
        m_BeginTimerPicker.onDestroy();
        //mEndTimerPicker.onDestroy();
    }

        @Override
        public void onClick (View v){
        switch (v.getId()) {
            case R.id.ll_start_time:
                m_bSelectBegin = true;
                // yyyy-MM-dd HH:mm:ss
                m_BeginTimerPicker.show(m_TvSelectedStartTime.getText().toString());
                break;

            case R.id.ll_end_time:
                m_bSelectBegin = false;
                // yyyy-MM-dd HH:mm:ss
                m_BeginTimerPicker.show(m_TvSelectedEndTime.getText().toString());
                break;

            case R.id.button_search:
                //search for file
                m_fileInfoList.clear();
                NET_DVR_FILECOND lpSearchInfo = new NET_DVR_FILECOND();
                NET_DVR_TIME timeStart = new NET_DVR_TIME();
                NET_DVR_TIME timeStop = new NET_DVR_TIME();

                //Converting the time string acquired by the interface to Date type
                Date startDateFormat = null;
                Date endDateFormat = null;
                try {
                    startDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA).parse(m_TvSelectedStartTime.getText().toString());
                    endDateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA).parse(m_TvSelectedEndTime.getText().toString());
                } catch (ParseException e) {
                    e.printStackTrace();
                }
                //The date type-related getyear interface is no longer in use, so it will be converted to CalenDar for date
                Calendar calStart = Calendar.getInstance();
                Calendar calEnd = Calendar.getInstance();
                calStart.setTime(startDateFormat);
                calEnd.setTime(endDateFormat);

                //Compare the size of the time, the end time is greater than the start time before the search.
                if (calEnd.compareTo(calStart) < 0) {
                    Toast.makeText(FragPlayBackByFile.this, "The EndTime should larger than StartTime", Toast.LENGTH_SHORT).show();
                    return;
                }
                //Toast.makeText(FragPlayBackByFile.this, "Searching The File,Please wait for moment!", Toast.LENGTH_SHORT).show();

                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStart,calStart);
                SDKGuider.g_sdkGuider.m_comPBGuider.ConvertToTime(timeStop,calEnd);
                lpSearchInfo.lChannel = m_iSelectChannel;
                lpSearchInfo.dwFileType = 0xff;
                lpSearchInfo.dwIsLocked = 0xff;
                lpSearchInfo.dwUseCardNo = 0;
                lpSearchInfo.struStartTime = timeStart;
                lpSearchInfo.struStopTime = timeStop;

                m_iFindHandle = SDKGuider.g_sdkGuider.m_comPBGuider.FindFile_V30_jni(m_iUserID, lpSearchInfo);
                if (m_iFindHandle == -1) {
                    Toast.makeText(FragPlayBackByFile.this, "NET_DVR_FindFile_V30 failed,Error：" + HCNetSDK.getInstance().NET_DVR_GetLastError(), Toast.LENGTH_SHORT).show();
                    return;
                }

                Thread thread = new Thread() {
                    @Override
                    public void run() {
                        int iFindNext = 0;
                        int iFileNum = 1;
                        m_fileInfoList.clear();
                        NET_DVR_FINDDATA_V30 struFindData = new NET_DVR_FINDDATA_V30();

                        while (iFindNext != -1) {
                            iFindNext = SDKGuider.g_sdkGuider.m_comPBGuider.FindNextFile_V30_jni(m_iFindHandle, struFindData);
                            if (iFindNext == HCNetSDK.NET_DVR_FILE_SUCCESS) {
                                int iLength = returnActualLength(struFindData.sFileName);
                                FileInfo info1 = new FileInfo("NO." + iFileNum, new String(struFindData.sFileName,0,iLength));
                                m_fileInfoList.add(info1);
                                iFileNum++;
                                continue;
                            } else if (HCNetSDK.NET_DVR_FILE_NOFIND == iFindNext) {
                                hander.sendEmptyMessage(HCNetSDK.NET_DVR_FILE_NOFIND);
                                break;
                            } else if (HCNetSDK.NET_DVR_NOMOREFILE == iFindNext) {
                                m_adapter = new FileAdapter(FragPlayBackByFile.this, R.layout.activity_file_item, m_fileInfoList);
                                hander.sendEmptyMessage(HCNetSDK.NET_DVR_NOMOREFILE);
                                break;
                            } else if (HCNetSDK.NET_DVR_FILE_EXCEPTION == iFindNext) {
                                hander.sendEmptyMessage(HCNetSDK.NET_DVR_FILE_EXCEPTION);
                                break;
                            } else if (HCNetSDK.NET_DVR_ISFINDING == iFindNext) {
                                try {
                                    sleep(5);
                                } catch (InterruptedException e) {
                                    e.printStackTrace();
                                }
                                continue;
                            }
                        }
                        SDKGuider.g_sdkGuider.m_comPBGuider.FindClose_V30_jni(m_iFindHandle);
                    }
                };
                thread.start();

                break;
        }
    }
    private Handler hander = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch(msg.what){
                case HCNetSDK.NET_DVR_NOMOREFILE:
                    m_adapter.notifyDataSetChanged();//Send a message to notify ListView of updates
                    m_listView.setAdapter(m_adapter);// Resetting the Data Adapter for ListView
                    break;
                case HCNetSDK.NET_DVR_FILE_NOFIND:
                    Toast.makeText(FragPlayBackByFile.this, "No file found", Toast.LENGTH_SHORT).show();
                    break;
                case HCNetSDK.NET_DVR_FILE_EXCEPTION:
                    Toast.makeText(FragPlayBackByFile.this, "Exception in searching", Toast.LENGTH_SHORT).show();
                    break;
                default:
                    break;
            }
        }
    };

    public int returnActualLength(byte[] data) {
        int i = 0;
        for (; i < data.length; i++) {
            if (data[i] == '\0')
                break;
        }
        return i;
    }

        //listview Presented class information
        public class FileInfo {
            private String fileIndex;//Indexes
            private String fileName;   //file name

            public FileInfo(String fileIndex, String fileName) {
                this.fileIndex = fileIndex;
                this.fileName = fileName;
            }

            public String getFileName() {
                return fileName;
            }

            public String getFileIndex() {
                return fileIndex;
            }

        }

        public class FileAdapter extends ArrayAdapter<FileInfo> {
            private int resourceId;

            public FileAdapter(Context context, int textViewResourceId, List<FileInfo> objects) {
                super(context, textViewResourceId, objects);
                resourceId = textViewResourceId;
            }

            @Override
            public View getView(int Position, View convertView, ViewGroup parent) {
                FileInfo fileInfo = getItem(Position);
                View view;
                if (convertView == null) {
                    view = LayoutInflater.from(getContext()).inflate(resourceId, parent, false);
                } else {
                    view = convertView;
                }
                TextView fileIndex = (TextView) view.findViewById(R.id.fileIndex);
                TextView fileName = (TextView) view.findViewById(R.id.fileName);

                fileIndex.setText(fileInfo.getFileIndex());
                fileName.setText(fileInfo.getFileName());

                return view;
            }
        }
    }
