package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview;

import android.app.Dialog;
import android.graphics.PixelFormat;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.view.LayoutInflater;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.Model.DBDevice;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO;

import java.util.ArrayList;
import java.util.List;

public class FragPreview extends FragBase implements SurfaceHolder.Callback {

    // 设备列表
    private List<DevManageGuider.DeviceItem> mDeviceList = new ArrayList<>();
    
    // SurfaceView数组
    private SurfaceView[] mSurfaceViews = new SurfaceView[9];
    private SurfaceHolder[] mSurfaceHolders = new SurfaceHolder[9];
    private int[] mPreviewHandles = new int[9];
    
    // 设备名称TextView数组
    private TextView[] mDeviceNameViews = new TextView[9];
    
    // 气体浓度
    private TextView mGasConcentrationView;
    
    // 作业人员容器
    private LinearLayout mWorkerContainer;
    
    final private int REQUEST_CODE_ASK_PERMISSIONS = 123;
    
    // 作业人员数据（示例数据）
    private List<WorkerInfo> mWorkerList = new ArrayList<>();
    
    public static class WorkerInfo {
        public String name;
        public int age;
        public int heartbeat;
        public int bloodOxygen;
        
        public WorkerInfo(String name, int age, int heartbeat, int bloodOxygen) {
            this.name = name;
            this.age = age;
            this.heartbeat = heartbeat;
            this.bloodOxygen = bloodOxygen;
        }
    }

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
        initWorkerData();
    }

    private void initWorkerData() {
        // 初始化作业人员示例数据
        mWorkerList.add(new WorkerInfo("张三", 28, 72, 98));
        mWorkerList.add(new WorkerInfo("李四", 32, 68, 99));
        mWorkerList.add(new WorkerInfo("王五", 35, 75, 97));
    }

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {

        View rootView = inflater.inflate(R.layout.activity_frag_preview, container, false);

        // 初始化SurfaceView
        initSurfaceViews(rootView);
        
        // 初始化气体浓度显示
        mGasConcentrationView = rootView.findViewById(R.id.gas_concentration);
        updateGasConcentration();
        
        // 初始化作业人员容器
        mWorkerContainer = rootView.findViewById(R.id.worker_container);
        initWorkers();
        
        // 加载设备并开始预览
        loadDevicesAndStartPreview();
        
        checkPermission();
        return rootView;
    }

    private void initSurfaceViews(View rootView) {
        for (int i = 0; i < 9; i++) {
            int surfaceViewId = getResources().getIdentifier("preview_surface_" + (i + 1), "id", getActivity().getPackageName());
            int deviceNameId = getResources().getIdentifier("device_name_" + (i + 1), "id", getActivity().getPackageName());
            
            mSurfaceViews[i] = rootView.findViewById(surfaceViewId);
            mDeviceNameViews[i] = rootView.findViewById(deviceNameId);
            
            if (mSurfaceViews[i] != null) {
                mSurfaceViews[i].getHolder().addCallback(this);
                // 多路预览不要使用 setZOrderOnTop(true)，避免仅一窗显示/遮挡问题
                mSurfaceViews[i].setZOrderOnTop(false);
                mSurfaceHolders[i] = mSurfaceViews[i].getHolder();
                mPreviewHandles[i] = -1;
            }
        }
    }

    private void loadDevicesAndStartPreview() {
        // 从数据库加载设备
        DBDevice dbDevice = DBDevice.getInstance(getActivity());
        mDeviceList.clear();
        
        ArrayList<DevManageGuider.DeviceItem> dbDevices = dbDevice.getAllDevices();
        if (dbDevices != null && !dbDevices.isEmpty()) {
            mDeviceList.addAll(dbDevices);
            android.util.Log.d("FragPreview", "加载到 " + dbDevices.size() + " 个设备");
            
            // 延迟一下确保SurfaceView已经初始化完成
            mSurfaceViews[0].postDelayed(new Runnable() {
                @Override
                public void run() {
                    // 开始预览
                    startAllPreviews();
                }
            }, 500);
        } else {
            android.util.Log.d("FragPreview", "没有找到设备");
        }
    }

    private void startAllPreviews() {
        for (int i = 0; i < 9 && i < mDeviceList.size(); i++) {
            DevManageGuider.DeviceItem device = mDeviceList.get(i);
            startPreviewForScreen(i, device);
        }
    }

    private void startPreviewForScreen(int screenIndex, DevManageGuider.DeviceItem device) {
        if (mSurfaceViews[screenIndex] == null) return;
        
        String deviceName = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
        
        // 显示设备名称
        if (mDeviceNameViews[screenIndex] != null) {
            mDeviceNameViews[screenIndex].setText(deviceName);
        }
        
        // 在后台线程中处理登录和预览
        new Thread(() -> {
            try {
                // 保存当前选中的设备索引，避免影响其他分屏
                int originalSelectedIndex = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex();
                
                // 检查设备是否需要登录
                if (device.m_struDevState.m_iLogState != 1) {
                    android.util.Log.d("FragPreview", "设备 " + deviceName + " 需要登录");
                    boolean loginSuccess = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                        device.m_szDevName, device.m_struNetInfo);
                    
                    if (loginSuccess) {
                        android.util.Log.d("FragPreview", "设备 " + deviceName + " 登录成功");
                        
                        // 更新设备信息
                        DevManageGuider.DeviceItem loggedInDevice = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                        if (loggedInDevice != null) {
                            device.m_lUserID = loggedInDevice.m_lUserID;
                            device.m_struDevState.m_iLogState = loggedInDevice.m_struDevState.m_iLogState;
                            device.m_struDeviceInfoV40_jna = loggedInDevice.m_struDeviceInfoV40_jna;
                        }
                    } else {
                        android.util.Log.e("FragPreview", "设备 " + deviceName + " 登录失败");
                        return;
                    }
                }
                
                // 恢复原来的选中设备索引
                SDKGuider.g_sdkGuider.m_comDMGuider.setCurrSelectDevIndex(originalSelectedIndex);
                
                // 在主线程中开始预览
                getActivity().runOnUiThread(() -> {
                    startPreviewAfterLogin(screenIndex, device);
                });
            } catch (Exception e) {
                android.util.Log.e("FragPreview", "启动预览异常", e);
            }
        }).start();
    }

    private void startPreviewAfterLogin(int screenIndex, DevManageGuider.DeviceItem device) {
        if (device.m_lUserID == -1) {
            android.util.Log.e("FragPreview", "设备UserID无效");
            return;
        }
        
        if (mSurfaceViews[screenIndex] == null || mSurfaceViews[screenIndex].getHolder() == null) {
            android.util.Log.e("FragPreview", "SurfaceView或Holder为null");
            return;
        }
        
        NET_DVR_PREVIEWINFO previewInfo = new NET_DVR_PREVIEWINFO();
        previewInfo.lChannel = 1; // 通道号
        previewInfo.dwStreamType = 0; // 主码流
        previewInfo.dwLinkMode = 0; // TCP
        previewInfo.bBlocked = 0; // 非阻塞
        previewInfo.hHwnd = mSurfaceViews[screenIndex].getHolder();
        
        android.util.Log.d("FragPreview", "分屏 " + (screenIndex + 1) + " 准备启动预览，UserID: " + device.m_lUserID);
        
        int handle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(
            device.m_lUserID, previewInfo, null);
        
        if (handle != -1) {
            mPreviewHandles[screenIndex] = handle;
            android.util.Log.d("FragPreview", "分屏 " + (screenIndex + 1) + " 预览成功，句柄: " + handle);
        } else {
            int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
            android.util.Log.e("FragPreview", "分屏 " + (screenIndex + 1) + " 预览失败，错误代码: " + errorCode);
        }
    }

    private void stopPreview(int screenIndex) {
        if (mPreviewHandles[screenIndex] != -1) {
            SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(mPreviewHandles[screenIndex]);
            mPreviewHandles[screenIndex] = -1;
        }
    }

    private void initWorkers() {
        mWorkerContainer.removeAllViews();
        
        for (int i = 0; i < mWorkerList.size(); i++) {
            WorkerInfo worker = mWorkerList.get(i);
            View cardView = LayoutInflater.from(getActivity()).inflate(R.layout.activity_worker_card, null);
            
            ImageView photoView = cardView.findViewById(R.id.worker_photo);
            TextView nameView = cardView.findViewById(R.id.worker_name);
            
            nameView.setText(worker.name);
            
            // 设置点击事件
            cardView.setOnClickListener(v -> showWorkerDetailDialog(worker));
            
            // 设置权重，让一行5个均匀分布，高度与宽度相同
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
            params.setMargins(4, 0, 4, 0);
            cardView.setLayoutParams(params);
            
            // 设置卡片高度，保持正方形
            cardView.post(new Runnable() {
                @Override
                public void run() {
                    int width = cardView.getWidth();
                    if (width > 0) {
                        cardView.setMinimumHeight(width);
                        LinearLayout.LayoutParams layoutParams = (LinearLayout.LayoutParams) cardView.getLayoutParams();
                        if (layoutParams != null) {
                            layoutParams.height = width;
                            cardView.setLayoutParams(layoutParams);
                        }
                    }
                }
            });
            
            mWorkerContainer.addView(cardView);
        }
    }

    private void showWorkerDetailDialog(WorkerInfo worker) {
        final Dialog dialog = new Dialog(getActivity());
        dialog.setContentView(R.layout.dialog_worker_detail);
        
        TextView nameView = dialog.findViewById(R.id.detail_name);
        TextView ageView = dialog.findViewById(R.id.detail_age);
        TextView heartbeatView = dialog.findViewById(R.id.detail_heartbeat);
        TextView bloodOxygenView = dialog.findViewById(R.id.detail_blood_oxygen);
        
        nameView.setText("姓名: " + worker.name);
        ageView.setText("年龄: " + worker.age + "岁");
        heartbeatView.setText(worker.heartbeat + " bpm");
        bloodOxygenView.setText(worker.bloodOxygen + "%");
        
        dialog.findViewById(R.id.btn_close).setOnClickListener(v -> dialog.dismiss());
        
        dialog.show();
    }

    private void updateGasConcentration() {
        // 显示默认气体浓度值（后续可以更新为实时数据）
        mGasConcentrationView.setText("56 PPM");
    }

    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        holder.setFormat(PixelFormat.OPAQUE);
    }

    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
        // Surface尺寸改变时的处理
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        // Surface销毁时的处理
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        // 停止所有预览
        for (int i = 0; i < 9; i++) {
            stopPreview(i);
        }
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
