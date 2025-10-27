package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Configure;

import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.Button;
import android.widget.Toast;
import android.widget.AdapterView;


import java.lang.String;
import java.util.ArrayList;

import com.hik.netsdk.SimpleDemo.Control.DevConfigGuider;
import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

public class FragConfig extends FragBase {
    public static final String ARGS_PAGE = "args_page";
    private TextView textView;
    private int mPage;
    private ArrayList<String> data=new ArrayList<String>();
    private ArrayList<String> toastConfigInfo=new ArrayList<String>();
    private ArrayAdapter<String> adapter;
    private Button btn_configTest = null;
    private Button btn_manageTest = null;
    private Button btn_pictureTest = null;
    private Button btn_PTZTest = null;
    private Button btn_screenTest = null;
    private Button btn_otherFunctionTest = null;
    private ListView listView=null;




    public static FragConfig newInstance(MainActivity mainActivity, Bundle args) {
        FragConfig fragment = new FragConfig();
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
        final View rootView = inflater.inflate(R.layout.frag_configure, container, false);
//        textView = rootView.findViewById(R.id.textView2);
//        textView.setText("Congure");
        fnBindScreenTestBtn(rootView);
        fnBindconfigTestBtn(rootView);
        fnBindPictureTestBtn(rootView);
        fnBindManageTestBtn(rootView);
        fnBindPTZTestBtn(rootView);
        fnBindOtherFunctionBtn(rootView);

        return rootView;
    }

    public void fnBindScreenTestBtn(View rootView)
    {
        btn_screenTest=(Button)rootView.findViewById(R.id.ScreenTest);
        btn_screenTest.setOnClickListener(new View.OnClickListener() {
            //@Override

            int flag=0;
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                    return;
                }
                
                // 检查设备是否已登录，如果未登录则自动登录
                DevManageGuider.DeviceItem deviceInfo = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                if(deviceInfo != null && deviceInfo.m_struDevState.m_iLogState != 1) {
                    android.util.Log.d("FragConfig", "设备未登录，尝试自动登录");
                    Toast.makeText(m_mainActivity, "正在登录设备...", Toast.LENGTH_SHORT).show();
                    
                    boolean loginSuccess = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                        deviceInfo.m_szDevName, deviceInfo.m_struNetInfo);
                    
                    if(loginSuccess) {
                        Toast.makeText(m_mainActivity, "设备登录成功", Toast.LENGTH_SHORT).show();
                    } else {
                        int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
                        Toast.makeText(m_mainActivity, "设备登录失败，错误代码: " + errorCode, Toast.LENGTH_LONG).show();
                        return;
                    }
                }
                
                {
                switch(flag)
                {
                    case 0:
                        btn_screenTest.setActivated(false);
                        flag=1;
                        break;
                    case 1:
                        btn_screenTest.setActivated(true);
                        flag=0;
                }
                data.clear();
                data.add("test_ControlScreen");
                data.add("test_SignalList");
                data.add("test_FileInfo");
                data.add("test_SerialAbility");
                data.add("test_loginCfg");
                data.add("test_PlayingPlan");
                data.add("test_CtrlPlan");
                data.add("test_Plan");
                data.add("test_VWParam");
                data.add("test_CurrentScene");

                data.add("test_SceneControl");
                data.add("test_DecChanEnable");
                data.add("test_SwitchWin");
                data.add("test_WallInParam");
                data.add("test_CloseAll");
                data.add("test_Position");
                data.add("test_DisplayPosition");
                data.add("test_WallOutput");
                data.add("test_PlanList");
                data.add("test_ScreenCtrl");

                data.add("test_UploadFile");
                data.add("test_Download");
                data.add("test_ScreenFileList");
                data.add("test_ScreenConfig");
                data.add("test_ScreenConfigCap");
                data.add("test_WallAbility");
                data.add("test_LEDCard");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();
                //
                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                    @Override
                    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                            String strToast = "";
                            switch (position) {

                                case 0:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_ControlScreen_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_CONTROL_SCREEN success!";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO succ");
                                        } else {
                                            strToast = "NET_DVR_CONTROL_SCREEN fail,error code =" + ret.status_1 + "\n";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO fail,errorCode is"+ret.status_1);
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 1:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_SignalList_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GetInputSignalList_V40 success!";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO succ");
                                        } else {
                                            strToast = "NET_DVR_GetInputSignalList_V40 fail,error code =" + ret.status_1 + "\n";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO fail,errorCode is"+ret.status_1);
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 2:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_FileInfo_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_SCREEN_FILEINFO succ";

                                        } else {
                                            strToast = "NET_DVR_GET_SCREEN_FILEINFO fail,errorCode is" + ret.status_1 + "\n";

                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SET_SCREEN_FILEINFO succ";

                                        } else {
                                            strToast += "NET_DVR_SET_SCREEN_FILEINFO fail,errorCode is" + ret.status_2;

                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 3:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_SerialAbility_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GetDeviceAbility success!";
                                        } else {
                                            strToast = "NET_DVR_GetDeviceAbility fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 4:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_loginCfg_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_STDXMLConfig success!";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO succ");
                                        } else {
                                            strToast = "NET_DVR_STDXMLConfig fail,error code =" + ret.status_1 + "\n";
                                            //toastConfigInfo.add("NET_DVR_GET_SCREEN_FILEINFO fail,errorCode is"+ret.status_1);
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 5:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_PlayingPlan_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_PLAYING_PLAN success!";
                                        } else {
                                            strToast = "NET_DVR_GET_PLAYING_PLAN fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 6:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_CtrlPlan_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_CTRL_PLAN success!";
                                        } else {
                                            strToast = "NET_DVR_CTRL_PLAN fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 7:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_CtrlPlan_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_SET_PLAN success!";
                                        } else {
                                            strToast = "NET_DVR_SET_PLAN fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 8:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_VWParam_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_VW_SCENE_PARAM succ";
                                        } else {
                                            strToast = "NET_DVR_GET_VW_SCENE_PARAM fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SET_VW_SCENE_PARAM success";
                                        } else {
                                            strToast += "NET_DVR_SET_VW_SCENE_PARAM fail,error code =" + ret.status_2 + "\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast += "NET_DVR_GET_VW_SCENE_PARAM success";
                                        } else {
                                            strToast += "NET_DVR_GET_VW_SCENE_PARAM fail,error code " + ret.status_3;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 9:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_CurrentScene_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_CURRENT_SCENE success!";
                                        } else {
                                            strToast = "NET_DVR_GET_CURRENT_SCENE fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 10:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_SceneControl_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_SCENE_CONTROL success!";
                                        } else {
                                            strToast = "NET_DVR_SCENE_CONTROL fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 11:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_DecChanEnable_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_MatrixGetDecChanEnable succ";
                                        } else {
                                            strToast = "NET_DVR_MatrixGetDecChanEnable fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_MaxtrixSetDecChanEnable success";
                                        } else {
                                            strToast += "NET_DVR_MaxtrixSetDecChanEnable fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 12:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_SwitchWin_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_SWITCH_WIN_TOP succ";
                                        } else {
                                            strToast = "NET_DVR_SWITCH_WIN_TOP fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SWITCH_WIN_BOTTOM success";
                                        } else {
                                            strToast += "NET_DVR_SWITCH_WIN_BOTTOM fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 13:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_WallInParam_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_WALLWINPARAM_GET succ";
                                        } else {
                                            strToast = "NET_DVR_WALLWINPARAM_GET fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_WALLWINPARAM_SET success";
                                        } else {
                                            strToast += "NET_DVR_WALLWINPARAM_SET fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 14:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_CloseAll_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_VIDEOWALLWINDOW_CLOSEALL success!";
                                        } else {
                                            strToast = "NET_DVR_VIDEOWALLWINDOW_CLOSEALL fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 15:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_Position_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_VIDEOWALLWINDOWPOSITION succ";
                                        } else {
                                            strToast = "NET_DVR_GET_VIDEOWALLWINDOWPOSITION fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SET_VIDEOWALLWINDOWPOSITION success";
                                        } else {
                                            strToast += "NET_DVR_SET_VIDEOWALLWINDOWPOSITION fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 16:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_DisplayPosition_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_VIDEOWALLDISPLAYPOSITION succ";
                                        } else {
                                            strToast = "NET_DVR_GET_VIDEOWALLDISPLAYPOSITION fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SET_VIDEOWALLDISPLAYPOSITION success";
                                        } else {
                                            strToast += "NET_DVR_SET_VIDEOWALLDISPLAYPOSITION fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 17:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_Position_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_VIDEOWALLWINDOWPOSITION succ";
                                        } else {
                                            strToast = "NET_DVR_GET_VIDEOWALLWINDOWPOSITION fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SET_VIDEOWALLWINDOWPOSITION success";
                                        } else {
                                            strToast += "NET_DVR_SET_VIDEOWALLWINDOWPOSITION fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 18:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_PlanList_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GetPlanList success!";
                                        } else {
                                            strToast = "NET_DVR_GetPlanList fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 19:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_ScreenCtrl_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_StartRemoteConfig NET_DVR_START_SCREEN_CRTL succ";
                                        } else {
                                            strToast = "NET_DVR_StartRemoteConfig NET_DVR_START_SCREEN_CRTL fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_SendRemoteConfig NET_DVR_START_SCREEN_CRTL success";
                                        } else {
                                            strToast += "NET_DVR_SendRemoteConfig NET_DVR_START_SCREEN_CRTL fail,error code =" + ret.status_2 + "\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast += "NET_DVR_StopRemoteConfig NET_DVR_START_SCREEN_CRTL success";
                                        } else {
                                            strToast += "NET_DVR_StopRemoteConfig NET_DVR_START_SCREEN_CRTL fail,error code " + ret.status_3;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 20:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_UploadFile_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GetPlanList success!";
                                        } else {
                                            strToast = "NET_DVR_GetPlanList fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 21:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_Download_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_StartDownload succ";
                                        } else {
                                            strToast = "NET_DVR_StartDownload fail,errorCode is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_StopDownload success";
                                        } else {
                                            strToast += "NET_DVR_StopDownload fail,error code =" + ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 22:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_ScreenFileList_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_StartRemoteConfig NET_DVR_GET_SCREEN_FLIE_LIST succ";
                                        } else {
                                            strToast = "NET_DVR_StartRemoteConfig NET_DVR_GET_SCREEN_FLIE_LIST is" + ret.status_1 + "\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_GetRemoteConfigState NET_DVR_GET_SCREEN_FLIE_LIST success";
                                        } else {
                                            strToast += "NET_DVR_GetRemoteConfigState NET_DVR_GET_SCREEN_FLIE_LIST fail,error code =" + ret.status_2 + "\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast += "NET_DVR_GetNextRemoteConfig NET_DVR_GET_SCREEN_FLIE_LIST success";
                                        } else {
                                            strToast += "NET_DVR_GetNextRemoteConfig NET_DVR_GET_SCREEN_FLIE_LIST fail,error code " + ret.status_3;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 23:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_ScreenConfig_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_SCREEN_CONFIG success!";
                                        } else {
                                            strToast = "NET_DVR_GET_SCREEN_CONFIG fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 24:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_ScreenConfigCap_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GET_SCREEN_CONFIG_CAP success!";
                                        } else {
                                            strToast = "NET_DVR_GET_SCREEN_CONFIG_CAP fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 25:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_WallAbility_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_GetDeviceAbility WallAbility success!";
                                        } else {
                                            strToast = "NET_DVR_GetDeviceAbility WallAbility fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 26:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.test_LEDCard_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast = "NET_DVR_STDXMLConfig(PUT)  success!";
                                        } else {
                                            strToast = "NET_DVR_STDXMLConfig(PUT)  fail,error code =" + ret.status_1 + "\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }

                    }
                });
            }}
        });
    }

    public  void fnBindconfigTestBtn(View rootView)
    {
        btn_configTest=(Button)rootView.findViewById(R.id.ConfigTest);
        btn_configTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                }
                else
                {
                data.clear();

//                data.add("Test_Time");
//                data.add("Test_XMLAbility");
//                data.add("Test_PTZProtocol");
//                data.add("Test_PresetName");
//                data.add("Test_ShowString");
//                data.add("Test_DigitalChannelState");
//                data.add("Test_DDNSPara");
//                data.add("Test_APInfoList");
//                data.add("Test_WifiCfg");
//                data.add("Test_WifiStatus");
//
//                data.add("Test_UpnpNatState");
//                data.add("Test_UserCfg");
//                data.add("Test_DeviceCfg");
//                data.add("Test_DeviceCfg_V40");
//                data.add("Test_ExceptionCfg_V40");
//                data.add("Test_PicCfg");
//                data.add("Test_ZeroChanCfg");
//                data.add("Test_WorkState");
                data.add("Test_RecordCfg");
//                data.add("Test_AuxAlarmCfg");
//
//                data.add("Test_AlarminCfg");
//                data.add("Test_AlarmOutCfg");
//                data.add("Test_DecoderCfg");
//                data.add("Test_NTPPara");
//                data.add("Test_IPAlarmOutCfg");
//                data.add("Test_IPParaCfg");
//                data.add("Test_NetCfg");
//                data.add("Test_CompressionCfg");
//                data.add("Test_CompressCfgAud");
//                data.add("Test_AlarmOutStatus");
//
//                data.add("Test_VideoEffect");
//                data.add("Test_Preview_display");
//                data.add("Text_FISHEYE_ABILITY");
//                data.add("Test_CAMERAPARAMCFG_EX");
//                data.add("Test_WIRELESSDIAL_CFG");
//                data.add("Test_PostRadar_Capabilities");
//                data.add("TextOSD");
//                data.add("Test_EzvizCreate");
//                data.add("Test_EzvizXMLConfig");
//                data.add("Test_EzvizServerDeviceInfo");
//
//                data.add("Test_EzvizAlarmInParamList");
//                data.add("Test_EzvizCallerInfo");
//                data.add("Test_EzvizRemoteGatway");
//                data.add("Test_EzvizCallSignal");
//                data.add("Test_EzvizPawdAuth");
//                data.add("TestAlarmHostMainStatus");
//                data.add("TestMCUAbility");
//                data.add("TextTrialMachine");
//                data.add("TestWIRELESSDIAL_CFG");
//                data.add("Text_Trail_ABILITY");
//
//                data.add("Test_LEDArea");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();

                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                        @Override
                        public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                            if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                                String strToast = "";
                                switch (position){
                                    case 0:
                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                            SDKGuider.g_sdkGuider.m_comConfGuider.Test_RecordCfg(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        }
                                        break;
//                                    case 0:
//                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                            DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_SearchLog_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                            //向listView写数据
//                                            if (ret.status_1 == 0) {
//                                                strToast ="NET_DVR_GET_TIMECFG success!";
//                                            } else {
//                                                strToast ="NET_DVR_GET_TIMECFG fail,error code ="+ret.status_1+"\n";
//                                            }
//                                            Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                            adapter.notifyDataSetChanged();
//                                        }
//                                        break;
//                                    case 1:
//                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                            DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ShutDown_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                            //向listView写数据
//                                            if (ret.status_1 == 0) {
//                                                strToast ="DEVICE_ENCODE_ALL_ABILITY_V20 success!";
//                                            } else {
//                                                strToast ="DEVICE_ENCODE_ALL_ABILITY_V20 fail,error code ="+ret.status_1+"\n";
//                                            }
//                                            Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                            adapter.notifyDataSetChanged();
//                                        }
//                                        break;
//                                    case 2:
//                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                            DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_RebootDVR_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                            //向listView写数据
//                                            if (ret.status_1 == 0) {
//                                                strToast ="NET_DVR_GetPTZProtocol success!";
//                                            } else {
//                                                strToast ="NET_DVR_GetPTZProtocol fail,error code ="+ret.status_1+"\n";
//                                            }
//                                            Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                            adapter.notifyDataSetChanged();
//                                        }
//                                        break;
//                                    case 3:
//                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                            DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ClickKey_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                            //向listView写数据
//                                            if (ret.status_1 == 0) {
//                                                strToast ="NET_DVR_GET_PRESET_NAME success!";
//                                            } else {
//                                                strToast ="NET_DVR_GET_PRESET_NAME fail,error code ="+ret.status_1+"\n";
//                                            }
//                                            Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                            adapter.notifyDataSetChanged();
//                                        }
//                                        break;
//                                    case 4:
//                                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                            DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_FormatDisk_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                            //向listView写数据
//                                            if (ret.status_1 == 0) {
//                                                strToast ="NET_DVR_GET_SHOWSTRING_V30 succ";
//                                            } else {
//                                                strToast ="NET_DVR_GET_SHOWSTRING_V30 fail,errorCode is"+ret.status_1+"\n";
//                                            }
//                                            if (ret.status_2 == 0) {
//                                                strToast += "NET_DVR_SET_SHOWSTRING_V30 success";
//                                            } else {
//                                                strToast+="NET_DVR_SET_SHOWSTRING_V30 fail,error code ="+ret.status_2;
//                                            }
//                                            Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                            adapter.notifyDataSetChanged();
//                                        }
//                                        break;
                                    default:
                                        break;
                                }


                            }
                        }
                    });

                }}
        });
    }

    public void fnBindManageTestBtn(View rootView)
    {
        btn_manageTest=(Button)rootView.findViewById(R.id.ManageTest);
        btn_manageTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                }
                else
                {
                data.clear();
                data.add("Test_SearchLog");
                data.add("Test_ShutDown");
                data.add("Test_RebootDVR");
                data.add("Test_ClickKey");
                data.add("Test_FormatDisk");
                data.add("Test_Upgrade");
                data.add("Test_ActivateDevice");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();

                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                    @Override
                    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                            String strToast = "";
                            switch (position){
                                case 0:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_SearchLog_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFormatProgress success!";
                                        } else {
                                            strToast ="NET_DVR_CONTROL_SCREEN fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 1:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ShutDown_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_ShutDownDVR success!";
                                        } else {
                                            strToast ="NET_DVR_ShutDownDVR fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 2:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_RebootDVR_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_RebootDVR success!";
                                        } else {
                                            strToast ="NET_DVR_RebootDVR fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 3:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ClickKey_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_ClickKey success!";
                                        } else {
                                            strToast ="NET_DVR_ClickKey fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 4:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_FormatDisk_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFormatProgress succ";
                                        } else {
                                            strToast ="NET_DVR_GetFormatProgress fail,errorCode is"+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_CloseFormatHandle success";
                                        } else {
                                            strToast+="NET_DVR_CloseFormatHandle fail,error code ="+ret.status_2;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 5:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_Upgrade_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SetNetworkEnvironment succ";
                                        } else {
                                            strToast ="NET_DVR_SetNetworkEnvironment fail,errorCode is"+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast += "NET_DVR_Upgrade success";
                                        } else {
                                            strToast+="NET_DVR_Upgrade fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast += "NET_DVR_GetUpgradeProgress success";
                                        } else {
                                            strToast+="NET_DVR_GetUpgradeProgress fail,error code ="+ret.status_3;
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 6:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ActivateDevice_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_ActivateDevice success!";
                                        } else {
                                            strToast ="NET_DVR_ActivateDevice fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                default:
                                    break;
                            }


                        }
                    }
                });


            }}
        });
    }

    public void fnBindPictureTestBtn(View rootView)
    {
        btn_pictureTest=(Button)rootView.findViewById(R.id.PictureTest);

        btn_pictureTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                }
                else
                {
                data.clear();
                data.add("PicUpload");
                data.add("BaseMap");
                data.add("BasemapCfg");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();

                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                    @Override
                    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                            String strToast = "";
                            switch (position){
                                case 0:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.PicUpload(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PicUpload success!";
                                        } else {
                                            strToast ="NET_DVR_PicUpload fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 1:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.BaseMap(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SET_BASEMAP_WIN_CFG success!";
                                        } else {
                                            strToast ="NET_DVR_SET_BASEMAP_WIN_CFG fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 2:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.BasemapCfg(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GET_BASEMAP_PIC_INFO success!";
                                        } else {
                                            strToast ="NET_DVR_GET_BASEMAP_PIC_INFO fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_GET_BASEMAP_CFG success!";
                                        } else {
                                            strToast ="NET_DVR_GET_BASEMAP_CFG fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast ="NET_DVR_SET_BASEMAP_CFG success!";
                                        } else {
                                            strToast ="NET_DVR_SET_BASEMAP_CFG fail,error code ="+ret.status_3+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                default:
                                    break;
                            }


                        }
                    }
                });


            }}
        });
    }

    public void fnBindPTZTestBtn(View rootView)
    {
        btn_PTZTest=(Button)rootView.findViewById(R.id.PTZTest);

        btn_PTZTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                }
                else
                {
                data.clear();
                //data.add("Test_PTZControl");
                //data.add("Test_PTZControlWithSpeed");
                //data.add("Test_PTZPreset");
                //data.add("Test_PTZCruise");
                //data.add("Test_PTZTrack");
                //data.add("Test_PTZSelZoomIn");
                data.add("Test_PTZControl_Other");
                data.add("Test_PTZControlWithSpeed_Other");
                data.add("Test_PTZPreset_Other");
                data.add("Test_PTZCruise_Other");
                data.add("Test_PTZTrack_Other");
                data.add("Test_PTZSelZoomIn_EX");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();

                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                    @Override
                    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                            String strToast = "";
                            switch (position){
//                                case 0:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZControl(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="PTZControl  PAN_LEFT 0  success!";
//                                        } else {
//                                            strToast ="PTZControl  PAN_LEFT 0  fail,error code ="+ret.status_1+"\n";
//                                        }
//
//                                        if (ret.status_2 == 0) {
//                                            strToast ="PTZControl  PAN_LEFT 1  success!";
//                                        } else {
//                                            strToast ="PTZControl  PAN_LEFT 1  fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
//                                case 1:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZControlWithSpeed(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="PTZControlWithSpeed  PAN_RIGHT 0 success!";
//                                        } else {
//                                            strToast ="PTZControlWithSpeed  PAN_RIGHT 0 fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        if (ret.status_2 == 0) {
//                                            strToast ="PTZControlWithSpeed  PAN_RIGHT 1 success!";
//                                        } else {
//                                            strToast ="PTZControlWithSpeed  PAN_RIGHT 1 fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
//                                case 2:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZPreset(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="PTZPreset  GOTO_PRESET success!";
//                                        } else {
//                                            strToast ="PTZPreset  GOTO_PRESET fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
//                                case 3:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZCruise(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="PTZCruise  RUN_SEQ success!";
//                                        } else {
//                                            strToast ="PTZCruise  RUN_SEQ,error code ="+ret.status_1+"\n";
//                                        }
//                                        if (ret.status_2 == 0) {
//                                            strToast ="PTZCruise  STOP_SEQ success!";
//                                        } else {
//                                            strToast ="PTZCruise  STOP_SEQ,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
//                                case 4:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZTrack(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="NET_DVR_PTZTrack  RUN_CRUISE success!";
//                                        } else {
//                                            strToast ="NET_DVR_PTZTrack  RUN_CRUISE fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
//                                case 5:
//                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
//                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZSelZoomIn(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
//                                        //向listView写数据
//                                        if (ret.status_1 == 0) {
//                                            strToast ="NET_DVR_PTZSelZoomIn success!";
//                                        } else {
//                                            strToast ="NET_DVR_PTZSelZoomIn fail,error code ="+ret.status_1+"\n";
//                                        }
//                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
//                                        adapter.notifyDataSetChanged();
//                                    }
//                                    break;
                                case 0:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZControl_Other(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZControl_Other  TILT_UP 0 success!";
                                        } else {
                                            strToast ="NET_DVR_PTZControl_Other  TILT_UP 0,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_PTZControl_Other  TILT_UP 1 success!";
                                        } else {
                                            strToast ="NET_DVR_PTZControl_Other  TILT_UP 1,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 1:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZControlWithSpeed_Other(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID, 1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZControlWithSpeed_Other  PAN_RIGHT 0 success!";
                                        } else {
                                            strToast ="NET_DVR_PTZControlWithSpeed_Other  PAN_RIGHT 0 fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_PTZControlWithSpeed_Other  PAN_RIGHT 1 success!";
                                        } else {
                                            strToast ="NET_DVR_PTZControlWithSpeed_Other  PAN_RIGHT 1 fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 2:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZPreset_Other(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZPreset_Other  GOTO_PRESET success!";
                                        } else {
                                            strToast ="NET_DVR_PTZPreset_Other  GOTO_PRESET fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 3:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZCruise_Other(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZCruise_Other  RUN_SEQ success!";
                                        } else {
                                            strToast ="NET_DVR_PTZCruise_Other  RUN_SEQ fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_PTZCruise_Other  STOP_SEQ success!";
                                        } else {
                                            strToast ="NET_DVR_PTZCruise_Other  STOP_SEQ fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 4:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZTrack_Other(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZTrack_Other  RUN_CRUISE success!";
                                        } else {
                                            strToast ="NET_DVR_PTZTrack_Other  RUN_CRUISE fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 5:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PTZSelZoomIn_EX(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_PTZSelZoomIn_EX success!";
                                        } else {
                                            strToast ="NET_DVR_PTZSelZoomIn_EX fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                default:
                                    break;
                            }


                        }
                    }
                });


            }}
        });
    }

    public void fnBindOtherFunctionBtn(View rootView)
    {
        btn_otherFunctionTest=(Button)rootView.findViewById(R.id.OtherFunction);
        btn_otherFunctionTest.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() == null)
                {
                    Toast.makeText(m_mainActivity,"please login first!",Toast.LENGTH_LONG).show();
                }
                else
                {
                data.clear();
                /*NUNM=26*/
                data.add("Test_FindFile");
                data.add("Test_FindFileByEvent");
                data.add("Test_GetFileDownload");
                data.add("Test_PlayBackConvert");
                data.add("Test_GetFileByTime");
                data.add("Test_GetFileByName");
                data.add("Test_UpdateRecordIndex");
                data.add("Test_CaptureJpegPicture");
                data.add("Test_CaptureJpegPicture_new");
                data.add("Test_DVRRecord");

                data.add("Test_TransChannel");
                data.add("Test_Serial");
                data.add("Test_ZeroChanPreview");
                data.add("Test_Hikonline");
                data.add("Test_IPServer");
                data.add("Test_DVRSetConnectTime");
                data.add("Test_DVRSetReConnect");
                data.add("Test_SDKLOCAL_CFG");
                data.add("Test_GetSDKVersion");
                data.add("Test_DVRMakeKeyFrame");

                data.add("Test_DVRMakeKeyFrameSub");
                data.add("Test_SetRecvTimeOut");
                data.add("Test_RecycleGetStream");
                data.add("Test_GetCurrentAudioCompress_V50");
                data.add("Test_MultiThreadLogin");
                data.add("Test_EzvizConfig");

                adapter = new ArrayAdapter<String>(m_mainActivity,android.R.layout.simple_list_item_1,data);
                listView=(ListView)rootView.findViewById(R.id.list_view);
                listView.setAdapter(adapter);
                adapter.notifyDataSetChanged();

                listView.setOnItemClickListener(new AdapterView.OnItemClickListener(){
                    @Override
                    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                        if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev() != null) {
                            String strToast = "";
                            switch (position){
                                case 0:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_FindFile_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_FindFile_V30  success!";
                                        } else {
                                            strToast ="NET_DVR_FindFile_V30  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 1:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_FindFileByEvent_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_FindFileByEvent  success!";
                                        } else {
                                            strToast ="NET_DVR_FindFileByEvent  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 2:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_GetFileDownload_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFileByName  success!";
                                        } else {
                                            strToast ="NET_DVR_GetFileByName  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_SET_TRANS_TYPE  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_PlayBackControl_V40  fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast ="NET_DVR_PLAYSTART  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_PlayBackControl_V40  fail,error code ="+ret.status_3+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 3:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_PlayBackConvert_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFileByName  success!";
                                        } else {
                                            strToast ="NET_DVR_GetFileByName  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_SET_TRANS_TYPE  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_PlayBackControl_V40  fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast ="NET_DVR_PLAYSTART  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_PlayBackControl_V40  fail,error code ="+ret.status_3+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 4:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_GetFileByTime_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFileByTime  success!";
                                        } else {
                                            strToast ="NET_DVR_GetFileByTime  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 5:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_GetFileByName_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetFileByTime  success!";
                                        } else {
                                            strToast ="NET_DVR_GetFileByTime  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 6:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_UpdateRecordIndex_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_UpdateRecordIndex  success!";
                                        } else {
                                            strToast ="NET_DVR_UpdateRecordIndex  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 7:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_CaptureJpegPicture_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_CaptureJPEGPicture  success!";
                                        } else {
                                            strToast ="NET_DVR_CaptureJPEGPicture  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 8:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_CaptureJpegPicture_new_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_CaptureJPEGPicture_NEW  success!";
                                        } else {
                                            strToast ="NET_DVR_CaptureJPEGPicture_NEW  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 9:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_DVRRecord_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_StartDVRRecord  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_StartDVRRecord  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_StopDVRRecord  success!";
                                        } else {
                                            strToast ="NET_DVR_StopDVRRecord  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 10:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_TransChannel_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SerialStart  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SerialStart  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_SerialSend  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SerialSend  fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast ="NET_DVR_SerialStop  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SerialStop  fail,error code ="+ret.status_3+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 11:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_Serial_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SendToSerialPort  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SendToSerialPort  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_SendTo232Port  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SendTo232Port  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 12:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_ZeroChanPreview_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_ZeroStartPlay  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_ZeroStartPlay  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_ZeroStopPlay  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_ZeroStopPlay  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 13:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_Hikonline_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="QUERYSVR_BY_COUNTRYID  success!"+"\n";
                                        } else {
                                            strToast ="QUERYSVR_BY_COUNTRYID  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="QUERYDEV_BY_NICKNAME_DDNS  success!"+"\n";
                                        } else {
                                            strToast ="QUERYDEV_BY_NICKNAME_DDNS  fail,error code ="+ret.status_2+"\n";
                                        }
                                        if (ret.status_3 == 0) {
                                            strToast ="QUERYDEV_BY_SERIAL_DDNS  success!"+"\n";
                                        } else {
                                            strToast ="QUERYDEV_BY_SERIAL_DDNS  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 14:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_IPServer_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="QUERYDEV_BY_NICKNAME_IPSERVER  success!"+"\n";
                                        } else {
                                            strToast ="QUERYDEV_BY_NICKNAME_IPSERVER  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="QUERYDEV_BY_SERIAL_IPSERVER  success!"+"\n";
                                        } else {
                                            strToast ="QUERYDEV_BY_SERIAL_IPSERVER  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 15:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_DVRSetConnectTime_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SetConnectTime  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SetConnectTime  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 16:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_DVRSetReConnect_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SetReconnect  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SetReconnect  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 17:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_SDKLOCAL_CFG_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetSDKLocalConfig  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_GetSDKLocalConfig  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_SetSDKLocalConfig  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SetSDKLocalConfig  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 18:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_GetSDKVersion_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetSDKVersion  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_GetSDKVersion  fail,error code ="+ret.status_1+"\n";
                                        }
                                        if (ret.status_2 == 0) {
                                            strToast ="NET_DVR_GetSDKVersion_GetSDKBuildVersion  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_GetSDKVersion_GetSDKBuildVersion  fail,error code ="+ret.status_2+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 19:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_DVRMakeKeyFrame_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_MakeKeyFrame  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_MakeKeyFrame  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 20:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_DVRMakeKeyFrameSub_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID,1);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_MakeKeyFrameSub  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_MakeKeyFrameSub  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 21:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_SetRecvTimeOut_jni();
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_SetRecvTimeOut  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_SetRecvTimeOut  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 23:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_GetCurrentAudioCompress_V50(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetCurrentAudioCompress_V50  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_GetCurrentAudioCompress_V50  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;
                                case 25:
                                    if (SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID != -1) {
                                        DevConfigGuider.CGReturn ret = SDKGuider.g_sdkGuider.m_comConfGuider.Test_EzvizConfig_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_lUserID);
                                        //向listView写数据
                                        if (ret.status_1 == 0) {
                                            strToast ="NET_DVR_GetSTDConfig  success!"+"\n";
                                        } else {
                                            strToast ="NET_DVR_GetSTDConfig  fail,error code ="+ret.status_1+"\n";
                                        }
                                        Toast.makeText(m_mainActivity, strToast, Toast.LENGTH_LONG).show();
                                        adapter.notifyDataSetChanged();
                                    }
                                    break;

                                default:
                                    break;
                            }


                        }
                    }
                });


            }}
        });
    }
}
