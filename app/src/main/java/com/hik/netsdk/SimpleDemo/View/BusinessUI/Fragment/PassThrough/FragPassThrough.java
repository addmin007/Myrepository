package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PassThrough;

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
import android.widget.EditText;
import android.widget.ListView;
import android.widget.SimpleAdapter;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;

import com.hik.netsdk.SimpleDemo.View.MainActivity;

import com.hikvision.netsdk.SerialDataCallBack;
import com.hikvision.netsdk.HCNetSDK;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;


public class FragPassThrough extends FragBase {

    DevManageGuider.DeviceItem m_deviceInfo = null;     //m_deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
    private View m_viewRoot = null;
    private View m_viewChannelNum = null;
    private View m_viewRecvData = null;
    private EditText m_inputSendData = null;
    private ListView m_listOutputData = null;
    private Spinner m_byChannelNum = null;
    private Spinner m_bySendMessageInterface = null;
    private int m_iSerialPortType = 1;
    private int m_iSerialChannel = 1;
    private int m_iInterface = 1;
    private boolean m_bIsOpenChannel = false;
    private int m_iSendDataHandle = -1;
    private TransportAdapter m_adapter;
    private List<TransInfo> m_TransInfoList = new ArrayList<>();
    private SerialDataBack m_clSerialCB = new SerialDataBack();

    public static FragPassThrough newInstance(MainActivity mainActivity, Bundle args) {
        FragPassThrough fragment = new FragPassThrough();
        fragment.setSDKGuider(mainActivity);
        if (args != null) {
            fragment.setArguments(args);
        }
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    public boolean openSerialTrans() {
        if(m_bIsOpenChannel == false)
        {
            m_iSendDataHandle = SDKGuider.g_sdkGuider.m_comSerialTransGuider.NET_DVR_SerialStart_jni(m_deviceInfo.m_lUserID, m_iSerialPortType, m_clSerialCB);
            if(m_iSendDataHandle == -1){
                Toast.makeText(m_mainActivity,"NET_DVR_SerialStart failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                return false;
            }
            m_bIsOpenChannel = true;
            return true;
        }
        else
        {
            Toast.makeText(m_mainActivity, "You've opened the serial channel", Toast.LENGTH_LONG).show();
            return true;
        }
    }

    public boolean closeSerialTrans(){
        if(m_bIsOpenChannel == true)
        {
            if(SDKGuider.g_sdkGuider.m_comSerialTransGuider.NET_DVR_SerialStop_jni(m_iSendDataHandle) == false)
            {
                Toast.makeText(m_mainActivity,"NET_DVR_SerialStop failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                return false;
            }
            m_iSendDataHandle = -1;
            m_bIsOpenChannel = false;
            return true;
        }
        else
        {
            Toast.makeText(m_mainActivity, "Please open the Serial channel first!", Toast.LENGTH_LONG).show();
            return false;
        }
    }

    class MyClickListener implements View.OnClickListener{
        @Override
        public void onClick(View v) {
            switch (v.getId())
            {
                case R.id.button_open_channel:
                    if(isOnlineOrChooseDev() == true) {
                        if(openSerialTrans() == true)
                        {
                            Toast.makeText(m_mainActivity, "The channel has opened", Toast.LENGTH_SHORT).show();
                        }
                    }
                    break;
                case R.id.button_close_channel:
                    if(isOnlineOrChooseDev() == true){
                        if(closeSerialTrans() == true)
                        {
                            Toast.makeText(m_mainActivity, "The channel has closed", Toast.LENGTH_SHORT).show();
                        }
                    }
                    break;
                case R.id.button_send_message:
                    if(isOnlineOrChooseDev() == true){
                        //选择发送接口类型，并进行发送
                        String strInputData = m_inputSendData.getText().toString();
                        int iInputBufSize = strInputData.length();
                        int m_iUserID = m_deviceInfo.m_lUserID;
                        switch (m_iInterface)
                        {
                            case 1:
                            {
                                if(m_iSendDataHandle == -1)
                                {
                                    Toast.makeText(m_mainActivity, "Please open the Serial channel first!", Toast.LENGTH_LONG).show();
                                    return;
                                }
                                if(SDKGuider.g_sdkGuider.m_comSerialTransGuider.NET_DVR_SerialSend_jni(m_iSendDataHandle, m_iSerialChannel, strToByteArray(strInputData), iInputBufSize) == false)
                                {
                                    Toast.makeText(m_mainActivity,"NET_DVR_SerialSend failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                                    return ;
                                }
                                break;
                            }
                            case 2:
                            {
                                if(SDKGuider.g_sdkGuider.m_comSerialTransGuider.NET_DVR_SendToSerialPort_jni(m_iUserID, m_iSerialPortType, m_iSerialChannel, strToByteArray(strInputData), iInputBufSize) == false)
                                {
                                    Toast.makeText(m_mainActivity,"NET_DVR_SendToSerialPort failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                                    return ;
                                }
                                break;
                            }
                            case 3:
                            {
                                if(SDKGuider.g_sdkGuider.m_comSerialTransGuider.NET_DVR_SendTo232Port_jni(m_iUserID, strToByteArray(strInputData), iInputBufSize) == false)
                                {
                                    Toast.makeText(m_mainActivity,"NET_DVR_SendTo232Port failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                                    return ;
                                }
                                break;
                            }
                            default:
                                break;
                        }
                        Toast.makeText(m_mainActivity, "The message has send", Toast.LENGTH_SHORT).show();
                        m_viewRecvData.setVisibility(View.VISIBLE);
                    }
                    break;
                default:
                    break;
            }
        }
    }

    public class SerialDataBack implements SerialDataCallBack{
        @Override
        public void fSerialDataCallBack(int iSerialHandle, byte[] byRecvBuf, int iBufSize){
            Log.println(Log.VERBOSE, "OUTPUT", ""+ iBufSize);
            String strRecvData = byteArrayToStr(byRecvBuf);
            String strHexRecvData = "";
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("HH:mm:ss");
            String strCurTime = simpleDateFormat.format(new Date());
            strHexRecvData = str2HexStr(strRecvData);
            TransInfo info1 = new TransInfo(strCurTime, strHexRecvData, strHexRecvData);
            m_TransInfoList.add(info1);
            m_adapter = new TransportAdapter(m_mainActivity, R.layout.activity_serial_trans_item, m_TransInfoList);
            hander.sendEmptyMessage(HCNetSDK.NET_DVR_NOMOREFILE);
        }
    }

    private Handler hander = new Handler() {
        @Override
        public void handleMessage(Message msg) {

            m_adapter.notifyDataSetChanged();//Send a message to notify ListView of updates
            m_listOutputData.setAdapter(m_adapter);// Resetting the Data Adapter for ListView
        }
    };

    public class TransInfo {
        private String time;
        private String content;
        private String hex;

        public TransInfo(String time, String content, String hex) {
            this.time = time;
            this.content = content;
            this.hex = hex;
        }

        public String getTime() {
            return time;
        }

        public String getContent() {
            return content;
        }

        public String getHex() {
            return hex;
        }
    }

    public class TransportAdapter extends ArrayAdapter<TransInfo> {
        private int resourceId;

        public TransportAdapter(Context context, int textViewResourceId, List<TransInfo> objects) {
            super(context, textViewResourceId, objects);
            resourceId = textViewResourceId;
        }

        @Override
        public View getView(int Position, View convertView, ViewGroup parent) {
            TransInfo transInfo = getItem(Position);
            View view;
            if (convertView == null) {
                view = LayoutInflater.from(getContext()).inflate(resourceId, parent, false);
            } else {
                view = convertView;
            }
            TextView time = (TextView) view.findViewById(R.id.transport_time);
            TextView content = (TextView) view.findViewById(R.id.transport_content);
            TextView hex = (TextView) view.findViewById(R.id.transport_hex_data);

            time.setText(transInfo.getTime());
            content.setText(transInfo.getContent());
            hex.setText(transInfo.getHex());
            return view;
        }
    }


    public boolean isOnlineOrChooseDev() {
        m_deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
        if(m_deviceInfo == null) {
            Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
            return false;
        }else {
            if(m_deviceInfo.m_struDevState.m_iLogState != 1){
                Toast.makeText(m_mainActivity, "please login first", Toast.LENGTH_SHORT).show();
                return false;
            }
        }
        return true;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        m_viewRoot = inflater.inflate(R.layout.frag_passthrough, container, false);
        m_viewChannelNum = m_viewRoot.findViewById(R.id.ll_channel);
        m_viewRecvData = m_viewRoot.findViewById(R.id.ll_recv_data);
        m_byChannelNum = (Spinner) m_viewRoot.findViewById(R.id.spinner_channel);
        m_bySendMessageInterface = (Spinner) m_viewRoot.findViewById(R.id.spinner_send_interface);
        m_inputSendData = m_viewRoot.findViewById(R.id.textinput_send_message);
        m_listOutputData = m_viewRoot.findViewById(R.id.listview_recvinfo);
        RadioGroup radioGroup = (RadioGroup) m_viewRoot.findViewById(R.id.radio_group_port_type);
        Button buttonOpenChannel = (Button) m_viewRoot.findViewById(R.id.button_open_channel);
        Button buttonCloseChannel = (Button) m_viewRoot.findViewById(R.id.button_close_channel);
        Button buttonSendMessage = (Button) m_viewRoot.findViewById(R.id.button_send_message);

        m_viewChannelNum.setVisibility(View.INVISIBLE);
        m_viewRecvData.setVisibility(View.INVISIBLE);

        buttonOpenChannel.setOnClickListener(new MyClickListener());
        buttonCloseChannel.setOnClickListener(new MyClickListener());
        buttonSendMessage.setOnClickListener(new MyClickListener());


        radioGroup.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener(){
            @Override
            public void onCheckedChanged(RadioGroup group, int checkedId) {
                if(isOnlineOrChooseDev() == true)
                {
                    RadioButton radioButton = (RadioButton)m_viewRoot.findViewById(radioGroup.getCheckedRadioButtonId());
                    m_iSerialPortType = (radioButton.getText().toString() .equals("232"))? 1 : 2;
                    int iChannelNum = (int) m_deviceInfo.m_struDeviceInfoV40_jna.struDeviceV30.byChanNum;
                    String[] strItems_channel =  new String[iChannelNum];
                    for(int i=0; i<iChannelNum; i++)
                    {
                        strItems_channel[i] = ("Channel "+(i+1));
                    }
                    String[] strItem_serial = new String[]{"Serial 1", "Serial 2"};
                    ArrayAdapter<String> arrayAdapter_serial = new ArrayAdapter<String>(getContext(), android.R.layout.simple_spinner_item, strItem_serial);
                    ArrayAdapter<String> arrayAdapter_channel = new ArrayAdapter<String>(getContext(), android.R.layout.simple_spinner_item, strItems_channel);
                    switch (m_iSerialPortType)
                    {
                        case 1:         //232
                        {
                            m_byChannelNum.setAdapter(arrayAdapter_serial);
                            break;
                        }
                        case 2:         //485
                        {
                            m_byChannelNum.setAdapter(arrayAdapter_channel);
                            break;
                        }
                        default:
                            break;
                    }
                    m_viewChannelNum.setVisibility(View.VISIBLE);
                }
            }
        });

        m_byChannelNum.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                m_iSerialChannel = i+1;
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        m_bySendMessageInterface.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                m_iInterface = i + 1;
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
            }
        });

        return m_viewRoot;
    }

    /**
     * 字符串转换成为16进制(无需Unicode编码)
     * @param str
     * @return
     */
    public static String str2HexStr(String str) {
        char[] chars = "0123456789ABCDEF".toCharArray();
        StringBuilder sb = new StringBuilder("");
        byte[] bs = str.getBytes();
        int bit;
        for (int i = 0; i < bs.length; i++) {
            bit = (bs[i] & 0x0f0) >> 4;
            sb.append(chars[bit]);
            bit = bs[i] & 0x0f;
            sb.append(chars[bit]);
        }
        return sb.toString().trim();
    }

    public byte[] strToByteArray(String str) {
        if (str == null) {
            return null;
        }
        byte[] byteArray = str.getBytes();
        return byteArray;
    }

    public String byteArrayToStr(byte[] byteArray) {
        if (byteArray == null) {
            return null;
        }
        String str = new String(byteArray);
        return str;
    }
}
