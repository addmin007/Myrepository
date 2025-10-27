package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Alarm;

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

import com.hcnetsdk.jna.HCNetSDKByJNA;
import com.hcnetsdk.jna.HCNetSDKJNAInstance;
import com.hik.netsdk.SimpleDemo.Control.DevAlarmGuider;
import com.hik.netsdk.SimpleDemo.Control.DevConfigGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Configure.CommonMethod;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack.FragPlayBackByFile;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hikvision.netsdk.AlarmCallBack_V30;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_ALARMER;
import com.hikvision.netsdk.NET_DVR_BASE_ALARM;
import com.sun.jna.Pointer;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


public class FragAlarm extends FragBase {
    public static final String ARGS_PAGE = "args_page";
    private TextView textView;
    private TextView textView_SetUpAlarm;
    private TextView textView_CloseAlarm;
    private int mPage;
    private ListView m_listView;
    AlarmAdapter m_adapter;
    private List<AlarmInfo> m_AlarmInfoList = new ArrayList<>();

    private Button btn_SetUpAlarm_jni = null;
    private Button btn_SetUpAlarm_jna = null;
    private Button btn_DelAlarm = null;

    public static FragAlarm newInstance(MainActivity mainActivity, Bundle args) {
        FragAlarm fragment = new FragAlarm();
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
        final View rootView = inflater.inflate(R.layout.frag_alarm, container, false);



        //向listView写入报警信息
        m_listView=(ListView)rootView.findViewById(R.id.list_view);

        /******************开启监听 jni****************/
        //绑定button资源
        btn_SetUpAlarm_jni=(Button)rootView.findViewById(R.id.button_setup_alarm_jni);
        //设置button监听
        btn_SetUpAlarm_jni.setOnClickListener(new View.OnClickListener() {
            //@Override
            int flag = 0;

            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        //jni
                        if(AlarmCbf == null)
                        {
                            AlarmCbf = new AlarmCallBack_V30()
                            {
                                public void fMSGCallBack( int lCommand, NET_DVR_ALARMER Alarmer, NET_DVR_BASE_ALARM AlarmInfo)
                                {
                                    processAlarmData_jni(lCommand, Alarmer, AlarmInfo);
                                    //ret.ip=Alarmer.sDeviceIP;
                                }
                            };
                        }

                        //JNI
                        if(!HCNetSDK.getInstance().NET_DVR_SetDVRMessageCallBack_V30(AlarmCbf))
                        {
                            System.out.println("NET_DVR_SetDVRMessageCallBack_V30 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError());
                        }

                        DevAlarmGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comDevAlarmGuider.Test_SetupAlarm_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                        if (ret.result == 0)
                        {
                            Toast.makeText(m_mainActivity,"NET_DVR_SetupAlarmChan_V41 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                        }
                        Toast.makeText(m_mainActivity,"NET_DVR_SetupAlarmChan_V41 succ!",Toast.LENGTH_LONG).show();
                    }
                }
                else
                {
                    Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
                }

            }
        });

        /******************开启监听 jna****************/
        //绑定button资源
        btn_SetUpAlarm_jna=(Button)rootView.findViewById(R.id.button_setup_alarm_jna);
        //设置button监听
        btn_SetUpAlarm_jna.setOnClickListener(new View.OnClickListener() {
            //@Override
            int flag = 0;

            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        //JNA
                        if(fnAlarmCallback == null)
                        {
                            fnAlarmCallback = new FMSGCallBack();
                        }
                        //JNA
                        if(!HCNetSDKJNAInstance.getInstance().NET_DVR_SetDVRMessageCallBack_V30(fnAlarmCallback, Pointer.NULL))
                        {
                            System.out.println("NET_DVR_SetDVRMessageCallBack_V30 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError());
                        }

                        DevAlarmGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comDevAlarmGuider.Test_SetupAlarm_V50_jna(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                        if (ret.result == 0)
                        {
                            Toast.makeText(m_mainActivity,"NET_DVR_SetupAlarmChan_V41 failed!" + HCNetSDK.getInstance().NET_DVR_GetLastError(),Toast.LENGTH_LONG).show();
                        }
                        Toast.makeText(m_mainActivity,"NET_DVR_SetupAlarmChan_V41 succ!",Toast.LENGTH_LONG).show();
                    }
                }
                else
                {
                    Toast.makeText(m_mainActivity, "get the deviceInfo failed", Toast.LENGTH_SHORT).show();
                }

            }
        });

        /*************关闭监听********************/
        //绑定button资源
        btn_DelAlarm=(Button)rootView.findViewById(R.id.button_del_alarm);
        //设置button监听
        btn_DelAlarm.setOnClickListener(new View.OnClickListener() {
            //@Override
            int flag = 0;
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null)
                {
                    if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1)
                    {
                        DevAlarmGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comDevAlarmGuider.Test_CloseAlarm_jni(SDKGuider.g_sdkGuider.m_comDevAlarmGuider.iAlarmHandle);
                        if(ret.result==0)
                        {
                            Toast.makeText(m_mainActivity, "NET_DVR_CloseAlarmChan_V30 failed! error:" + HCNetSDK.getInstance().NET_DVR_GetLastError(), Toast.LENGTH_LONG).show();
                        }
                        else {
                                Toast.makeText(m_mainActivity, "NET_DVR_CloseAlarmChan_V30 Succ!", Toast.LENGTH_LONG).show();
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


    private static AlarmCallBack_V30 AlarmCbf = null;
    private void processAlarmData_jni(int lCommand, NET_DVR_ALARMER Alarmer, NET_DVR_BASE_ALARM AlarmInfo)
    {
        String sIP = new String(Alarmer.sDeviceIP);
        System.out.println("recv alarm from:" + sIP);
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("HH:mm:ss");
        AlarmInfo info1 = new AlarmInfo(new String(simpleDateFormat.format(new Date())), new String(Alarmer.sDeviceIP), new String("" + lCommand));
        m_AlarmInfoList.add(info1);
        m_adapter = new AlarmAdapter(m_mainActivity, R.layout.activity_alarm_item, m_AlarmInfoList);
        hander.sendEmptyMessage(HCNetSDK.NET_DVR_NOMOREFILE);

//        if(lCommand == HCNetSDK.COMM_ITS_PLATE_RESULT)
//        {
//
//            NET_ITS_PLATE_RESULT strAlarmInfo = (NET_ITS_PLATE_RESULT)AlarmInfo;
//            System.out.println("recv Its Plate Result:" + strAlarmInfo.dwCustomIllegalType);
//            //ret.time=strAlarmInfo.struPicInfo[0].byAbsTime;
//        }
//        else if (lCommand == HCNetSDK.COMM_ALARM)
//        {
//            NET_DVR_ALARMINFO struAlarmInfo = (NET_DVR_ALARMINFO)AlarmInfo;
//
//        }
    }

    private static HCNetSDKByJNA.FMSGCallBack fnAlarmCallback = null;
    public class FMSGCallBack implements HCNetSDKByJNA.FMSGCallBack
    {
        @Override
        public void invoke(int lCommand, HCNetSDKByJNA.NET_DVR_ALARMER pAlarmer,
                           Pointer pAlarmInfo, int dwBufLen, Pointer pUser) {
            // TODO Auto-generated method stub

            String sIP = new String(pAlarmer.sDeviceIP);
            System.out.println("recv alarm from:" + sIP);
            SimpleDateFormat simpleDateFormat = new SimpleDateFormat("HH:mm:ss");
            AlarmInfo info1 = new AlarmInfo(new String(simpleDateFormat.format(new Date())), new String(pAlarmer.sDeviceIP), new String("" + lCommand));
            m_AlarmInfoList.add(info1);
            m_adapter = new AlarmAdapter(m_mainActivity, R.layout.activity_alarm_item, m_AlarmInfoList);
            hander.sendEmptyMessage(HCNetSDK.NET_DVR_NOMOREFILE);

            System.out.println("alarm type:" + lCommand);
            if(lCommand == HCNetSDKByJNA.COMM_ALARM_V30)
            {
                HCNetSDKByJNA.NET_DVR_ALARMINFO_V30	struAlarmInfo = new HCNetSDKByJNA.NET_DVR_ALARMINFO_V30(pAlarmInfo);
                struAlarmInfo.read();
                System.out.println("COMM_ALARM_V30 alarm type:" + struAlarmInfo.dwAlarmType);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_ALARM_V40)
            {
                HCNetSDKByJNA.NET_DVR_ALARMINFO_V40	struAlarmInfo = new HCNetSDKByJNA.NET_DVR_ALARMINFO_V40(pAlarmInfo);
                struAlarmInfo.read();
                System.out.println("COMM_ALARM_V40 alarm type:" + struAlarmInfo.struAlarmFixedHeader.dwAlarmType);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_UPLOAD_PLATE_RESULT)
            {
                HCNetSDKByJNA.NET_DVR_PLATE_RESULT	struAlarmInfo = new HCNetSDKByJNA.NET_DVR_PLATE_RESULT(pAlarmInfo);
                struAlarmInfo.read();

                try {
                    SimpleDateFormat   sDateFormat   =   new   SimpleDateFormat("yyyy-MM-dd-hh:mm:ss");
                    String   date   =   sDateFormat.format(new   java.util.Date());
                    FileOutputStream file = new FileOutputStream("/mnt/sdcard/" + date + ".bmp");
                    file.write(struAlarmInfo.pBuffer1.getPointer().getByteArray(0, struAlarmInfo.dwPicLen), 0, struAlarmInfo.dwPicLen);
                    file.close();
                } catch (IOException e) {
                    // TODO Auto-generated catch block
                    e.printStackTrace();
                }

                System.out.println("COMM_UPLOAD_PLATE_RESULT license:" + CommonMethod.toValidString(new String(struAlarmInfo.struPlateInfo.sLicense)));
            }
            else if(lCommand == HCNetSDKByJNA.COMM_ITS_PLATE_RESULT)
            {
                HCNetSDKByJNA.NET_ITS_PLATE_RESULT	struAlarmInfo = new HCNetSDKByJNA.NET_ITS_PLATE_RESULT(pAlarmInfo);
                struAlarmInfo.read();
                System.out.println("COMM_ITS_PLATE_RESULT license:" + CommonMethod.toValidString(new String(struAlarmInfo.struPlateInfo.sLicense)));
                System.out.println("COMM_ITS_PLATE_RESULT cTimeDifferenceH:" + struAlarmInfo.struSnapFirstPicTime.cTimeDifferenceH);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_ALARM_RULE)
            {
                HCNetSDKByJNA.NET_VCA_RULE_ALARM	struAlarmInfo = new HCNetSDKByJNA.NET_VCA_RULE_ALARM(pAlarmInfo);
                struAlarmInfo.read();
                if(struAlarmInfo.struRuleInfo.wEventTypeEx == HCNetSDKByJNA.ENUM_VCA_EVENT_EXIT_AREA)
                {
                    HCNetSDKByJNA.NET_VCA_AREA	struExit = new HCNetSDKByJNA.NET_VCA_AREA(struAlarmInfo.struRuleInfo.uEventParam.getPointer());
                    struExit.read();
                }

                System.out.println("COMM_ALARM_RULE rule name:" + CommonMethod.toValidString(new String(struAlarmInfo.struRuleInfo.byRuleName)));
            }

            else if(lCommand == HCNetSDKByJNA.COMM_VEHICLE_CONTROL_ALARM)
            {
                HCNetSDKByJNA.NET_DVR_VEHICLE_CONTROL_ALARM	struAlarmInfo = new HCNetSDKByJNA.NET_DVR_VEHICLE_CONTROL_ALARM(pAlarmInfo);
                struAlarmInfo.read();
                System.out.println("NET_DVR_VEHICLE_CONTROL_ALARM license:" + struAlarmInfo.byListType + "byPlateType:" + struAlarmInfo.byPlateType +
                        "sLicense:" +  CommonMethod.toValidString(new String(struAlarmInfo.sLicense)));
            }
            else if(lCommand == HCNetSDKByJNA.COMM_UPLOAD_FACESNAP_RESULT)
            {
                HCNetSDKByJNA.NET_VCA_FACESNAP_RESULT struFaceSnapAlarm = new HCNetSDKByJNA.NET_VCA_FACESNAP_RESULT(pAlarmInfo);
                struFaceSnapAlarm.read();

                HCNetSDKByJNA.NET_VCA_FACESNAP_ADDINFO pAddInfoBuffer = new HCNetSDKByJNA.NET_VCA_FACESNAP_ADDINFO(struFaceSnapAlarm.pAddInfoBuffer.getPointer());
                pAddInfoBuffer.read();
                System.out.println("COMM_UPLOAD_FACESNAP_RESULT dwFacePicID:" + struFaceSnapAlarm.dwFacePicID + "FaceScore:" + struFaceSnapAlarm.dwFaceScore);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_ALARM_PDC)
            {
                HCNetSDKByJNA.NET_DVR_PDC_ALRAM_INFO struAlarmPdc = new HCNetSDKByJNA.NET_DVR_PDC_ALRAM_INFO(pAlarmInfo);
                struAlarmPdc.read();
                System.out.println("COMM_ALARM_PDC dwSnapFacePicID:" + struAlarmPdc.dwEnterNum);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_ALARM_FACE_DETECTION)
            {
                HCNetSDKByJNA.NET_DVR_FACE_DETECTION struFaceDetect = new HCNetSDKByJNA.NET_DVR_FACE_DETECTION(pAlarmInfo);
                struFaceDetect.read();
                System.out.println("COMM_ALARM_FACE_DETECTION byFacePicNum:" + struFaceDetect.byFacePicNum);
            }
            else if(lCommand == HCNetSDKByJNA.COMM_SNAP_MATCH_ALARM)
            {
                HCNetSDKByJNA.NET_VCA_FACESNAP_MATCH_ALARM struFaceSnapMatchAlarm = new HCNetSDKByJNA.NET_VCA_FACESNAP_MATCH_ALARM(pAlarmInfo);
                struFaceSnapMatchAlarm.read();
                System.out.println("COMM_SNAP_MATCH_ALARM dwSnapFacePicID:" + struFaceSnapMatchAlarm.byMatchPicNum);
            }

            //门禁主机报警
            else if(lCommand == HCNetSDKByJNA.COMM_ALARM_ACS)
            {
                HCNetSDKByJNA.NET_DVR_ACS_ALARM_INFO struACSAlarm = new HCNetSDKByJNA.NET_DVR_ACS_ALARM_INFO(pAlarmInfo);
                struACSAlarm.read();

                //打印新增口罩字段
                System.out.println("COMM_ALARM_ACS byMask:" + struACSAlarm.struAcsEventInfo.byMask);

                //打印扩展信息中的事件流水号
                HCNetSDKByJNA.NET_DVR_ACS_EVENT_INFO_EXTEND struEventInfoEx = null;
                if (struACSAlarm.byAcsEventInfoExtend == 1)
                {
                    struEventInfoEx = new HCNetSDKByJNA.NET_DVR_ACS_EVENT_INFO_EXTEND(struACSAlarm.pAcsEventInfoExtend.getPointer());
                    struEventInfoEx.read();
                    System.out.println("COMM_ALARM_ACS dwFrontSerialNo:" + struEventInfoEx.dwFrontSerialNo);
                }

                //打印扩展信息v20
                if (struACSAlarm.byAcsEventInfoExtendV20 == 1)
                {
                    HCNetSDKByJNA.NET_DVR_ACS_EVENT_INFO_EXTEND_V20 struEventInfoExV20 =
                            new HCNetSDKByJNA.NET_DVR_ACS_EVENT_INFO_EXTEND_V20(struACSAlarm.pAcsEventInfoExtendV20.getPointer());
                    struEventInfoExV20.read();
                    System.out.println("COMM_ALARM_ACS byRemoteCheck:" + struEventInfoExV20.byRemoteCheck); //是否需要远程核验
                    System.out.println("COMM_ALARM_ACS dwQRCodeInfoLen:" + struEventInfoExV20.dwQRCodeInfoLen); //二维码长度
                    System.out.println("COMM_ALARM_ACS dwVisibleLightDataLen:" + struEventInfoExV20.dwVisibleLightDataLen); //可见光图片长度
                    System.out.println("COMM_ALARM_ACS dwThermalDataLen:" + struEventInfoExV20.dwThermalDataLen); //热成像图片长度

                    //保存热成像图片
                    try {
                        if (struEventInfoExV20.dwThermalDataLen > 0)
                        {
                            SimpleDateFormat   sDateFormat   =   new   SimpleDateFormat("yyyy-MM-dd-hh:mm:ss");
                            String   date   =   sDateFormat.format(new   java.util.Date());
                            FileOutputStream file = new FileOutputStream("/mnt/sdcard/sdklog/" + date + ".bmp");
                            file.write(struEventInfoExV20.pThermalData.getPointer().getByteArray(0, struEventInfoExV20.dwThermalDataLen), 0, struEventInfoExV20.dwThermalDataLen);
                            file.close();
                        }
                    } catch (IOException e) {
                        // TODO Auto-generated catch block
                        e.printStackTrace();
                    }

                    //保存可见光图片
                    try {
                        if(struEventInfoExV20.dwVisibleLightDataLen > 0)
                        {
                            SimpleDateFormat   sDateFormat   =   new   SimpleDateFormat("yyyy-MM-dd-hh:mm:ss");
                            String   date   =   sDateFormat.format(new   java.util.Date());
                            FileOutputStream file = new FileOutputStream("/mnt/sdcard/sdklog/" + date + "_visible.bmp");
                            file.write(struEventInfoExV20.pVisibleLightData.getPointer().getByteArray(0, struEventInfoExV20.dwVisibleLightDataLen), 0, struEventInfoExV20.dwVisibleLightDataLen);
                            file.close();
                        }
                    } catch (IOException e) {
                        // TODO Auto-generated catch block
                        e.printStackTrace();
                    }

                    //触发远程核验
                    if (struEventInfoExV20.byRemoteCheck == 1)
                    {
                        HCNetSDKByJNA.NET_DVR_XML_CONFIG_INPUT	struInput = new HCNetSDKByJNA.NET_DVR_XML_CONFIG_INPUT();
                        struInput.dwSize = struInput.size();

                        String str = "PUT /ISAPI/AccessControl/remoteCheck?format=json";
                        HCNetSDKByJNA.BYTE_ARRAY ptrRemoteCheckUrl = new HCNetSDKByJNA.BYTE_ARRAY(HCNetSDKByJNA.BYTE_ARRAY_LEN);
                        System.arraycopy(str.getBytes(), 0, ptrRemoteCheckUrl.byValue, 0, str.length());
                        ptrRemoteCheckUrl.write();
                        struInput.lpRequestUrl = ptrRemoteCheckUrl.getPointer();
                        struInput.dwRequestUrlLen = str.length();


                        String strInBuffer = "{\n" +
                                "    \"RemoteCheck\": {\n" +
                                "        \"serialNo\": " + struEventInfoEx.dwFrontSerialNo + "," +
                                "        \"checkResult\": \"success\"," +
                                "        \"info\": \"openAAAAAAAAAAAAAA\"," +
                                "    }\n" +
                                "}\n";

                        HCNetSDKByJNA.BYTE_ARRAY ptrByte = new HCNetSDKByJNA.BYTE_ARRAY(10*1024);
                        ptrByte.byValue = strInBuffer.getBytes();
                        ptrByte.write();
                        struInput.lpInBuffer = ptrByte.getPointer();
                        struInput.dwInBufferSize = strInBuffer.length();
                        struInput.write();

                        HCNetSDKByJNA.NET_DVR_XML_CONFIG_OUTPUT struOutput = new HCNetSDKByJNA.NET_DVR_XML_CONFIG_OUTPUT();
                        struOutput.dwSize = struOutput.size();

                        HCNetSDKByJNA.BYTE_ARRAY ptrOutByte = new HCNetSDKByJNA.BYTE_ARRAY(HCNetSDKByJNA.ISAPI_DATA_LEN);
                        struOutput.lpOutBuffer = ptrOutByte.getPointer();
                        struOutput.dwOutBufferSize = HCNetSDKByJNA.ISAPI_DATA_LEN;

                        HCNetSDKByJNA.BYTE_ARRAY ptrStatusByte = new HCNetSDKByJNA.BYTE_ARRAY(HCNetSDKByJNA.ISAPI_STATUS_LEN);
                        struOutput.lpStatusBuffer = ptrStatusByte.getPointer();
                        struOutput.dwStatusSize = HCNetSDKByJNA.ISAPI_STATUS_LEN;
                        struOutput.write();

                        int iUserID = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID;

                        if(!HCNetSDKJNAInstance.getInstance().NET_DVR_STDXMLConfig(iUserID, struInput, struOutput))
                        {
                            System.out.println("PUT /ISAPI/AccessControl/remoteCheck?format=json failed with:" + iUserID + " "+ HCNetSDKJNAInstance.getInstance().NET_DVR_GetLastError());
                            return;
                        }
                        else
                        {
                            System.out.println("PUT /ISAPI/AccessControl/remoteCheck?format=json success");
                            System.out.println("dwReturnXMLSize="+struOutput.dwReturnedXMLSize);
                            System.out.println(struOutput.lpOutBuffer.getString(0));
                        }
                    }
                }

            }
            //身份证信息上传
            else if(lCommand == HCNetSDKByJNA.COMM_ID_INFO_ALARM)
            {
                HCNetSDKByJNA.NET_DVR_ID_CARD_INFO_ALARM struIDCardInfoAlarm = new HCNetSDKByJNA.NET_DVR_ID_CARD_INFO_ALARM(pAlarmInfo);
                struIDCardInfoAlarm.read();

                //打印新增口罩字段
                System.out.println("COMM_ID_INFO_ALARM byMask:" + struIDCardInfoAlarm.byMask);
                //System.out.println("COMM_ID_INFO_ALARM dwSerialNo:" + struIDCardInfoAlarm.dwSerialNo); //事件流水号

                //打印扩展信息
                if (struIDCardInfoAlarm.byIDCardInfoExtend == 1)
                {
                    HCNetSDKByJNA.NET_DVR_ID_CARD_INFO_EXTEND struIDCardInfoEx =
                            new HCNetSDKByJNA.NET_DVR_ID_CARD_INFO_EXTEND(struIDCardInfoAlarm.pIDCardInfoExtend);
                    struIDCardInfoEx.read();
                    System.out.println("COMM_ID_INFO_ALARM byRemoteCheck:" + struIDCardInfoEx.byRemoteCheck); //是否需要远程核验
                    System.out.println("COMM_ID_INFO_ALARM dwQRCodeInfoLen:" + struIDCardInfoEx.dwQRCodeInfoLen); //二维码长度
                    System.out.println("COMM_ID_INFO_ALARM dwVisibleLightDataLen:" + struIDCardInfoEx.dwVisibleLightDataLen); //可见光图片长度
                    System.out.println("COMM_ID_INFO_ALARM dwThermalDataLen:" + struIDCardInfoEx.dwThermalDataLen); //热成像图片长度

                    //触发远程核验
                    if (struIDCardInfoEx.byRemoteCheck == 1)
                    {

                    }
                }
            }
            //ISAPI报警
            else if(lCommand == HCNetSDKByJNA.COMM_ISAPI_ALARM)
            {
                HCNetSDKByJNA.NET_DVR_ALARM_ISAPI_INFO struISAPIAlarm = new HCNetSDKByJNA.NET_DVR_ALARM_ISAPI_INFO(pAlarmInfo);
                struISAPIAlarm.read();

                //打印数据类型
                System.out.println("COMM_ISAPI_ALARM byDataType:" + struISAPIAlarm.byDataType);

                //打印报文
                byte[] szAlarmInfo = struISAPIAlarm.pAlarmData.getByteArray(0, struISAPIAlarm.dwAlarmDataLen);
                String szInfo = new String(szAlarmInfo);
                Log.d("COMM_ISAPI_ALARM", szInfo);

                //保存报警图片
                if(struISAPIAlarm.byPicturesNumber >= 1)
                {
                    int  offset = 0;
                    for(int i=0; i<struISAPIAlarm.byPicturesNumber; i++)
                    {
                        HCNetSDKByJNA.NET_DVR_ALARM_ISAPI_PICDATA struISAPIPicdata = new HCNetSDKByJNA.NET_DVR_ALARM_ISAPI_PICDATA();

                        Pointer pData = struISAPIPicdata.getPointer();

                        pData.write(0, struISAPIAlarm.pPicPackData.getByteArray(offset, struISAPIPicdata.size()),0, struISAPIPicdata.size());
                        offset = offset + struISAPIPicdata.size();
                        struISAPIPicdata.read();
                        try {
                            if(struISAPIPicdata.dwPicLen > 0)
                            {
                                if(struISAPIPicdata.byPicType == 1)//jpg
                                {
                                    SimpleDateFormat   sDateFormat   =   new   SimpleDateFormat("yyyy-MM-dd-hh:mm:ss");
                                    String   date   =   sDateFormat.format(new   java.util.Date());
                                    String   sFilename = new String(struISAPIPicdata.szFilename);
                                    FileOutputStream file = new FileOutputStream("/mnt/sdcard/sdklog/" + date + "_" + sFilename.trim() +".jpg");
                                    file.write(struISAPIPicdata.pPicData.getByteArray(0, struISAPIPicdata.dwPicLen), 0, struISAPIPicdata.dwPicLen);
                                    file.close();
                                }
                            }
                        } catch (IOException e) {
                            // TODO Auto-generated catch block
                            e.printStackTrace();
                        }
                    }
                }
            }

        }
    }






    private Handler hander = new Handler() {
        @Override
        public void handleMessage(Message msg) {

                    m_adapter.notifyDataSetChanged();//Send a message to notify ListView of updates
                    m_listView.setAdapter(m_adapter);// Resetting the Data Adapter for ListView
        }
    };

    public class AlarmInfo {
        private String time;
        private String ip;
        private String command;

        public AlarmInfo(String time, String ip, String command) {
            this.time = time;
            this.ip = ip;
            this.command = command;
        }

        public String getTime() {
            return time;
        }

        public String getIP() {
            return ip;
        }

        public String getCommand() {
            return command;
        }
    }

    public class AlarmAdapter extends ArrayAdapter<AlarmInfo> {
        private int resourceId;

        public AlarmAdapter(Context context, int textViewResourceId, List<AlarmInfo> objects) {
            super(context, textViewResourceId, objects);
            resourceId = textViewResourceId;
        }

        @Override
        public View getView(int Position, View convertView, ViewGroup parent) {
            AlarmInfo alarmInfo = getItem(Position);
            View view;
            if (convertView == null) {
                view = LayoutInflater.from(getContext()).inflate(resourceId, parent, false);
            } else {
                view = convertView;
            }
            TextView time = (TextView) view.findViewById(R.id.alarm_time);
            TextView ip = (TextView) view.findViewById(R.id.alarm_ip);
            TextView command = (TextView) view.findViewById(R.id.alarm_command);

            time.setText(alarmInfo.getTime());
            ip.setText(alarmInfo.getIP());
            command.setText(alarmInfo.getCommand());
            return view;
        }
    }
}

