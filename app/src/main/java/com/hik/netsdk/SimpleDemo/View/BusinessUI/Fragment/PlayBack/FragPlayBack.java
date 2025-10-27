package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.PlayBack;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v4.content.ContextCompat;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * brief：Playback fragment
 * author：hubinglun
 * date：2019/05/13
 */

public class FragPlayBack extends FragBase {
    DevManageGuider.DeviceItem m_deviceInfo = null;
    final private int REQUEST_CODE_ASK_PERMISSIONS = 123;
    public static FragPlayBack newInstance(MainActivity mainActivity, Bundle args) {
        FragPlayBack fragment = new FragPlayBack();

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
    }

    class MyListener implements View.OnClickListener{
        @Override
        public void onClick(View v) {
            switch (v.getId())
            {
                case R.id.button_by_time:
                    // Jump to Time Playback
                    //Intent intentPlayBackByTime = new Intent(getActivity(),FragPlayBackByTime.class);
                    //intent.putExtra("extra_data",data);
                    //startActivity(intentPlayBackByTime);

                    if(isOnlineOrChooseDev() == true) {
                        FragPlayBackByTime.instance(m_mainActivity, FragPlayBackByTime.class, null);
                    }
                    break;
                case R.id.button_by_file:
                    // Jump to Playback by File
                    if(isOnlineOrChooseDev() == true){
                        FragPlayBackByFile.instance(m_mainActivity, FragPlayBackByFile.class,null);
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
                // 设备未登录，尝试自动登录
                android.util.Log.d("FragPlayBack", "设备未登录，尝试自动登录");
                Toast.makeText(m_mainActivity, "正在登录设备...", Toast.LENGTH_SHORT).show();
                
                // 尝试登录设备
                boolean loginSuccess = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                    m_deviceInfo.m_szDevName, m_deviceInfo.m_struNetInfo);
                
                if(loginSuccess) {
                    // 更新设备信息
                    DevManageGuider.DeviceItem loggedInDevice = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                    if (loggedInDevice != null) {
                        m_deviceInfo.m_lUserID = loggedInDevice.m_lUserID;
                        m_deviceInfo.m_struDevState.m_iLogState = loggedInDevice.m_struDevState.m_iLogState;
                        m_deviceInfo.m_struDeviceInfoV40_jna = loggedInDevice.m_struDeviceInfoV40_jna;
                        android.util.Log.d("FragPlayBack", "设备登录成功，UserID: " + m_deviceInfo.m_lUserID);
                        Toast.makeText(m_mainActivity, "设备登录成功", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
                    android.util.Log.e("FragPlayBack", "设备登录失败，错误代码: " + errorCode);
                    Toast.makeText(m_mainActivity, "设备登录失败，错误代码: " + errorCode, Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        }
        return true;
}
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.fragment_play_back, container, false);

        Button buttonByTime = (Button) rootView.findViewById(R.id.button_by_time);
        Button buttonByFile = (Button) rootView.findViewById(R.id.button_by_file);
        buttonByTime.setOnClickListener(new MyListener());
        buttonByFile.setOnClickListener(new MyListener());
        //permissions when downloading files
        checkPermission();
        return rootView;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions, @NonNull int[] grantResults) {
        switch(requestCode) {
            case REQUEST_CODE_ASK_PERMISSIONS :
                if(grantResults[0]== PackageManager.PERMISSION_GRANTED) {
                    boolean bCreatFile = false;
                    File file = new File("/mnt/sdcard/download");
                    if(!file.exists()){
                        bCreatFile = file.mkdirs();
                        if(!bCreatFile){
                            Toast.makeText(m_mainActivity,
                                    "creat the flie fold failed",Toast.LENGTH_SHORT).show();
                        }
                    }
                }else{
                    Toast.makeText(m_mainActivity,
                            "Open the permission of storsge",Toast.LENGTH_SHORT).show();
                }
        }
        super.onRequestPermissionsResult(requestCode, permissions,
                grantResults);
    }


    public void checkPermission() {
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissionStrs = new ArrayList<>();
            int hasWriteSdcardPermission =
                    ContextCompat.checkSelfPermission(
                            m_mainActivity,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE);
            if(hasWriteSdcardPermission !=
                    PackageManager.PERMISSION_GRANTED) {

                permissionStrs.add(
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                );
            }
            String[]stringArray = permissionStrs.toArray(new String[0]);
            if (permissionStrs.size() > 0) {
                requestPermissions(stringArray,
                        REQUEST_CODE_ASK_PERMISSIONS);
                return;
            }
        }
    }
}
