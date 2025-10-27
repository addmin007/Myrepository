package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview;

import android.graphics.PixelFormat;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AppCompatActivity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.app.Activity;
import android.widget.AdapterView;
import android.view.MotionEvent;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview.FragPreviewBySurfaceView;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview.FragPreviewByTextureView;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;


public class FragPreview extends FragBase{

    DevManageGuider.DeviceItem m_deviceInfo = null;
    final private int REQUEST_CODE_ASK_PERMISSIONS = 123;
    public static FragPreview newInstance(MainActivity mainActivity, Bundle args) {
        FragPreview fragment = new FragPreview();
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


    class MyListener implements View.OnClickListener{
        @Override
        public void onClick(View v) {
            switch (v.getId())
            {
                case R.id.button_by_surfaceview:
                    if(isOnlineOrChooseDev() == true) {
                        FragPreviewBySurfaceView.instance(m_mainActivity, FragPreviewBySurfaceView.class, null);
                    }
                    break;
                case R.id.button_by_textview:
                    if(isOnlineOrChooseDev() == true){
                        FragPreviewByTextureView.instance(m_mainActivity, FragPreviewByTextureView.class,null);
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

    @Override

    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {

        View rootView = inflater.inflate(R.layout.activity_frag_preview, container, false);

        Button buttonBySurface = (Button) rootView.findViewById(R.id.button_by_surfaceview);
        Button buttonByText = (Button) rootView.findViewById(R.id.button_by_textview);
        buttonBySurface.setOnClickListener(new MyListener());
        buttonByText.setOnClickListener(new MyListener());
        checkPermission();
        return rootView;

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
