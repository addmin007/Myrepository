package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Transport;

import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.AdapterView;

import com.hcnetsdk.jna.HCNetSDKByJNA;
import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_XML_CONFIG_INPUT;
import com.hikvision.netsdk.NET_DVR_XML_CONFIG_OUTPUT;

public class FragTransport extends FragBase {
    DevManageGuider.DeviceItem m_deviceInfo = null;
    private EditText m_inputReqTransport = null;
    private Button m_btnResetText = null;
    private Button m_btnSendTransportReq = null;
    private TextView m_textResData = null;
    private Spinner m_spinnerMethod = null;
    private EditText m_inputReqURI = null;
    private int m_iUserID = -1;
    private String m_strResTransport = "";
    private String m_strReqMethod = "GET";
    private String m_strReqURL = "/ISAPI/";
    private String m_strReqParam = "";
    private NET_DVR_XML_CONFIG_INPUT lpInputParam = new NET_DVR_XML_CONFIG_INPUT();
    private NET_DVR_XML_CONFIG_OUTPUT lpOutputParam = new NET_DVR_XML_CONFIG_OUTPUT();
    private HCNetSDKByJNA.NET_DVR_XML_CONFIG_INPUT lpInputParam_jna = new HCNetSDKByJNA.NET_DVR_XML_CONFIG_INPUT();
    private HCNetSDKByJNA.NET_DVR_XML_CONFIG_OUTPUT lpOutputParam_jna = new HCNetSDKByJNA.NET_DVR_XML_CONFIG_OUTPUT();

    public static FragTransport newInstance(MainActivity mainActivity, Bundle args) {
        FragTransport fragment = new FragTransport();
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

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        final View viewRoot = inflater.inflate(R.layout.frag_transport, container, false);
        m_inputReqTransport = viewRoot.findViewById(R.id.text_input_transport_data);
        m_btnResetText = viewRoot.findViewById(R.id.button_text_reset);
        m_btnSendTransportReq = viewRoot.findViewById(R.id.button_transport_data_send);
        m_textResData = viewRoot.findViewById(R.id.text_response_data);
        m_spinnerMethod = viewRoot.findViewById(R.id.spinner_send_method);
        m_inputReqURI = viewRoot.findViewById(R.id.text_input_uri);
        m_btnResetText.setOnClickListener(new MyClickListener());
        m_btnSendTransportReq.setOnClickListener(new MyClickListener());
        m_spinnerMethod.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                m_strReqMethod= m_spinnerMethod.getItemAtPosition(i).toString();
                //Log.println(Log.INFO, "spinner set value", m_strReqHead + i);
                if(i != 0)
                    m_inputReqTransport.setVisibility(View.VISIBLE);
                else
                    m_inputReqTransport.setVisibility(View.GONE);
            }
            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {
                m_inputReqTransport.setVisibility(View.GONE);
            }
        });
        return viewRoot;
    }

class MyClickListener implements View.OnClickListener{
    @Override
    public void onClick(View v) {
        switch (v.getId())
        {
            case R.id.button_text_reset:
                m_inputReqTransport.setText("");
                m_inputReqURI.setText("/ISAPI/");
//                m_inputReqURI.setText("/ISAPI/System/capabilities"); //系统服务能力
//                m_inputReqURI.setText("/ISAPI/AccessControl/capabilities"); //门禁总能力
//                m_inputReqURI.setText("/ISAPI/AccessControl/maskDetection/capabilities?format=json"); //口罩检测配置能力
//                m_inputReqURI.setText("/ISAPI/AccessControl/maskDetection?format=json"); //获取，配置口罩检测
//                m_inputReqURI.setText("/ISAPI/AccessControl/AcsCfg/capabilities?format=json"); //门禁参数配置能力
//                m_inputReqURI.setText("/ISAPI/AccessControl/AcsCfg?format=json"); //获取，配置门禁参数
//                m_inputReqURI.setText("/ISAPI/AccessControl/remoteCheck/capabilities?format=json"); //远程核验能力
//                m_inputReqURI.setText("/ISAPI/AccessControl/remoteCheck?format=json"); //远程核验
                m_textResData.setText("");
                break;
            case R.id.button_transport_data_send:
                if(isOnlineOrChooseDev() == true){
                    sendTransportReq_jni();
                }
                break;
            default:
                break;
        }
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

    public void sendTransportReq_jni(){
        m_iUserID = m_deviceInfo.m_lUserID;
        m_strReqURL = m_inputReqURI.getText().toString();
        m_strReqParam = m_inputReqTransport.getText().toString();
        String strReqHead = m_strReqMethod + " " + m_strReqURL;
        lpInputParam.lpRequestUrl = strToByteArray(strReqHead);
        lpInputParam.dwRequestUrlLen = (strReqHead).length();
        lpInputParam.lpInBuffer = strToByteArray(m_strReqParam);
        lpInputParam.dwInBufferSize = m_strReqParam.length();
        lpInputParam.dwRecvTimeOut = 0;

        if(SDKGuider.g_sdkGuider.m_comTransportGuider.STDXMLConfig_jni(m_iUserID,  lpInputParam,  lpOutputParam) != true){
            Toast.makeText(m_mainActivity,"NET_DVR_STDXMLConfig failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
            m_strResTransport = byteArrayToStr(lpOutputParam.lpStatusBuffer);
        }
        else
        {
            m_strResTransport = byteArrayToStr(lpOutputParam.lpOutBuffer);
        }
        m_textResData.setText(m_strResTransport);
        //m_inputReqTransport.setText(m_strResTransport);
    }

    public void sendTransportReq_jna(){
        m_iUserID = m_deviceInfo.m_lUserID;

        m_strReqURL = m_inputReqURI.getText().toString();
        String strReqHead = m_strReqMethod + " " + m_strReqURL;
        HCNetSDKByJNA.BYTE_ARRAY strUrl = new  HCNetSDKByJNA.BYTE_ARRAY(strReqHead.length());
        System.arraycopy(strReqHead.getBytes(), 0, strUrl.byValue, 0, strReqHead.length());
        strUrl.write();
        lpInputParam_jna.lpRequestUrl = strUrl.getPointer();
        lpInputParam_jna.dwRequestUrlLen = (strReqHead).length();
        lpInputParam_jna.dwSize = lpInputParam_jna.size();

        if (m_inputReqTransport.getText().toString().length() != 0)
        {
            m_strReqParam = m_inputReqTransport.getText().toString();
            HCNetSDKByJNA.BYTE_ARRAY strParam = new  HCNetSDKByJNA.BYTE_ARRAY(m_strReqParam.length());
            System.arraycopy(m_strReqParam.getBytes(), 0, strParam.byValue, 0, m_strReqParam.length());
            strParam.write();
            lpInputParam_jna.lpInBuffer = strParam.getPointer();
            lpInputParam_jna.dwInBufferSize = m_strReqParam.length();
        }
        lpInputParam_jna.dwRecvTimeOut = 0;

        HCNetSDKByJNA.BYTE_ARRAY outBuf = new HCNetSDKByJNA.BYTE_ARRAY(100*1024);
        outBuf.write();
        lpOutputParam_jna.dwSize = lpOutputParam_jna.size();
        lpOutputParam_jna.lpOutBuffer = outBuf.getPointer();
        lpOutputParam_jna.dwOutBufferSize = 100*1024;
        HCNetSDKByJNA.BYTE_ARRAY statusBuf = new HCNetSDKByJNA.BYTE_ARRAY(1024);
        lpOutputParam_jna.lpStatusBuffer = statusBuf.getPointer();
        lpOutputParam_jna.dwStatusSize = 1024;
        statusBuf.write();
        lpOutputParam_jna.write();

        if(SDKGuider.g_sdkGuider.m_comTransportGuider.STDXMLConfig_jna(m_iUserID,  lpInputParam_jna,  lpOutputParam_jna) != true){
            Toast.makeText(m_mainActivity,"NET_DVR_STDXMLConfig failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
            m_strResTransport = lpOutputParam_jna.lpStatusBuffer.toString();
        }
        else
        {
            m_strResTransport = new String(lpOutputParam_jna.lpOutBuffer.getString(0));
        }
        m_textResData.setText(m_strResTransport);
        //m_inputReqTransport.setText(m_strResTransport);
    }
}