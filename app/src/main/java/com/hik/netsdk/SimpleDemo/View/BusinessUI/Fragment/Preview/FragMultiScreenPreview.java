package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.Preview;

import android.graphics.PixelFormat;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.view.LayoutInflater;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.Model.DBDevice;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hikvision.netsdk.HCNetSDK;
import com.hikvision.netsdk.NET_DVR_PREVIEWINFO;

import java.util.ArrayList;
import java.util.List;

public class FragMultiScreenPreview extends FragBase implements SurfaceHolder.Callback {
    
    // 分屏模式枚举
    public enum SplitMode {
        SINGLE(1), FOUR(4), NINE(9), SIXTEEN(16);
        
        private final int count;
        
        SplitMode(int count) {
            this.count = count;
        }
        
        public int getCount() {
            return count;
        }
    }
    
    // UI组件
    private Button mBtnSplit1, mBtnSplit4, mBtnSplit9, mBtnSplit16;
    private Button mBtnStartAll, mBtnStopAll, mBtnRefreshDevices, mBtnConfigDevices;
    
    // 侧边栏配置相关
    private View mSidebarConfig;
    private LinearLayout mDeviceConfigContainer;
    private Button mBtnApplyConfig, mBtnCloseSidebar;
    private Button mBtnRefreshDeviceList; // 刷新设备列表按钮
    private Spinner[] mScreenDeviceSpinners; // 每个分屏的设备选择器
    
    // 视频容器和SurfaceView
    private View mVideoContainer;
    private SurfaceView mSurfaceSingle;
    private LinearLayout mLayoutSplit4, mLayoutSplit9, mLayoutSplit16;
    
    // SurfaceView数组
    private SurfaceView[][] mSurfaceViews;
    private SurfaceHolder[][] mSurfaceHolders;
    private int[][] mPreviewHandles;
    
    // 设备信息显示TextView数组
    private TextView[][] mDeviceInfoTextViews;
    
    // 当前状态
    private SplitMode mCurrentSplitMode = SplitMode.SINGLE;
    private List<DevManageGuider.DeviceItem> mDeviceList = new ArrayList<>();
    
    // 预览相关
    private int mCurrentStreamType = 0; // 0:主码流, 1:子码流, 2:第三码流
    
    // 分屏设备配置 - 每个分屏对应的设备
    private DevManageGuider.DeviceItem[][] mScreenDeviceConfig = new DevManageGuider.DeviceItem[4][16]; // [分屏模式][分屏索引]
    private Spinner[][] mDeviceSpinners = new Spinner[4][16]; // 每个分屏模式的设备选择下拉框
    
    public static FragMultiScreenPreview newInstance(MainActivity mainActivity, Bundle args) {
        FragMultiScreenPreview fragment = new FragMultiScreenPreview();
        fragment.setSDKGuider(mainActivity);
        if (args != null) {
            fragment.setArguments(args);
        }
        return fragment;
    }

    public static FragMultiScreenPreview newInstance(Bundle args) {
        FragMultiScreenPreview fragment = new FragMultiScreenPreview();
        if (args != null) {
            fragment.setArguments(args);
        }
        return fragment;
    }

    public static FragMultiScreenPreview instance(MainActivity mainActivity, Class<?> cls, Bundle args) {
        return newInstance(mainActivity, args);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
    
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.activity_frag_multi_screen_preview, container, false);
        
        initViews(rootView);
        initSurfaceViews(rootView);
        setupClickListeners();
        initDeviceConfig();
        refreshDeviceList();
        
        return rootView;
    }
    
    private void initViews(View rootView) {
        mBtnSplit1 = rootView.findViewById(R.id.btn_split_1);
        mBtnSplit4 = rootView.findViewById(R.id.btn_split_4);
        mBtnSplit9 = rootView.findViewById(R.id.btn_split_9);
        mBtnSplit16 = rootView.findViewById(R.id.btn_split_16);
        mBtnStartAll = rootView.findViewById(R.id.btn_start_all);
        mBtnStopAll = rootView.findViewById(R.id.btn_stop_all);
        mBtnRefreshDevices = rootView.findViewById(R.id.btn_refresh_devices);
        mBtnConfigDevices = rootView.findViewById(R.id.btn_config_devices);
        mBtnRefreshDeviceList = rootView.findViewById(R.id.btn_refresh_device_list);
        
        // 初始化侧边栏组件
        mSidebarConfig = rootView.findViewById(R.id.sidebar_config);
        mDeviceConfigContainer = rootView.findViewById(R.id.device_config_container);
        mBtnApplyConfig = rootView.findViewById(R.id.btn_apply_config);
        mBtnCloseSidebar = rootView.findViewById(R.id.btn_close_sidebar);
        
        mVideoContainer = rootView.findViewById(R.id.video_container);
        mSurfaceSingle = rootView.findViewById(R.id.surface_single);
        mLayoutSplit4 = rootView.findViewById(R.id.layout_split_4);
        mLayoutSplit9 = rootView.findViewById(R.id.layout_split_9);
        mLayoutSplit16 = rootView.findViewById(R.id.layout_split_16);
        
    }
    
    private void initDeviceConfig() {
        // 初始化所有分屏设备配置为null（未配置）
        android.util.Log.d("FragMultiScreenPreview", "初始化设备配置数组");
        for (int i = 0; i < mScreenDeviceConfig.length; i++) {
            for (int j = 0; j < mScreenDeviceConfig[i].length; j++) {
                mScreenDeviceConfig[i][j] = null;
            }
        }
        printDeviceConfig("初始化后");
    }
    
    private void printDeviceConfig(String context) {
        android.util.Log.d("FragMultiScreenPreview", "=== " + context + " 设备配置状态 ===");
        for (int i = 0; i < mScreenDeviceConfig.length; i++) {
            for (int j = 0; j < mScreenDeviceConfig[i].length; j++) {
                DevManageGuider.DeviceItem device = mScreenDeviceConfig[i][j];
                android.util.Log.d("FragMultiScreenPreview", "分屏模式" + i + " 分屏" + j + ": " + 
                    (device != null ? device.m_szDevName : "未配置"));
            }
        }
        android.util.Log.d("FragMultiScreenPreview", "=== 设备配置状态结束 ===");
    }
    
    private String getErrorMessage(int errorCode) {
        switch (errorCode) {
            case 1: return "用户名密码错误";
            case 2: return "权限不足";
            case 3: return "密码错误";
            case 4: return "用户名错误";
            case 5: return "设备不在线";
            case 6: return "设备忙";
            case 7: return "用户名或密码错误";
            case 8: return "设备不支持";
            case 9: return "网络错误";
            case 10: return "设备连接失败";
            case 11: return "设备响应超时";
            case 12: return "设备认证失败";
            case 13: return "设备版本不匹配";
            case 14: return "设备资源不足";
            case 15: return "设备配置错误";
            default: return "未知错误 (错误代码: " + errorCode + ")";
        }
    }
    
    private void initSurfaceViews(View rootView) {
        // 初始化SurfaceView数组
        mSurfaceViews = new SurfaceView[4][16]; // 最多支持16分屏
        
        // 初始化设备信息TextView数组
        mDeviceInfoTextViews = new TextView[4][16];
        mSurfaceHolders = new SurfaceHolder[4][16];
        mPreviewHandles = new int[4][16];
        
        // 单屏
        mSurfaceViews[0][0] = mSurfaceSingle;
        mDeviceInfoTextViews[0][0] = rootView.findViewById(R.id.device_info_single);
        
        // 4分屏
        mSurfaceViews[1][0] = rootView.findViewById(R.id.surface_4_1);
        mSurfaceViews[1][1] = rootView.findViewById(R.id.surface_4_2);
        mSurfaceViews[1][2] = rootView.findViewById(R.id.surface_4_3);
        mSurfaceViews[1][3] = rootView.findViewById(R.id.surface_4_4);
        
        mDeviceInfoTextViews[1][0] = rootView.findViewById(R.id.device_info_4_1);
        mDeviceInfoTextViews[1][1] = rootView.findViewById(R.id.device_info_4_2);
        mDeviceInfoTextViews[1][2] = rootView.findViewById(R.id.device_info_4_3);
        mDeviceInfoTextViews[1][3] = rootView.findViewById(R.id.device_info_4_4);
        
        // 9分屏
        for (int i = 0; i < 9; i++) {
            int resId = getResources().getIdentifier("surface_9_" + (i + 1), "id", getActivity().getPackageName());
            mSurfaceViews[2][i] = rootView.findViewById(resId);
            
            int deviceInfoResId = getResources().getIdentifier("device_info_9_" + (i + 1), "id", getActivity().getPackageName());
            mDeviceInfoTextViews[2][i] = rootView.findViewById(deviceInfoResId);
        }
        
        // 16分屏
        for (int i = 0; i < 16; i++) {
            int resId = getResources().getIdentifier("surface_16_" + (i + 1), "id", getActivity().getPackageName());
            mSurfaceViews[3][i] = rootView.findViewById(resId);
            
            int deviceInfoResId = getResources().getIdentifier("device_info_16_" + (i + 1), "id", getActivity().getPackageName());
            mDeviceInfoTextViews[3][i] = rootView.findViewById(deviceInfoResId);
        }
        
        // 设置SurfaceHolder回调
        for (int mode = 0; mode < 4; mode++) {
            int maxCount = (mode == 0) ? 1 : (mode == 1) ? 4 : (mode == 2) ? 9 : 16;
            for (int i = 0; i < maxCount; i++) {
                if (mSurfaceViews[mode][i] != null) {
                    mSurfaceViews[mode][i].getHolder().addCallback(this);
                    // 多路预览不要使用 setZOrderOnTop(true)，避免仅一窗显示/遮挡问题
                    mSurfaceViews[mode][i].setZOrderOnTop(false);
                    mSurfaceHolders[mode][i] = mSurfaceViews[mode][i].getHolder();
                    mPreviewHandles[mode][i] = -1;
                }
            }
        }
    }
    
    private void setupClickListeners() {
        // 分屏模式切换
        mBtnSplit1.setOnClickListener(v -> switchSplitMode(SplitMode.SINGLE));
        mBtnSplit4.setOnClickListener(v -> switchSplitMode(SplitMode.FOUR));
        mBtnSplit9.setOnClickListener(v -> switchSplitMode(SplitMode.NINE));
        mBtnSplit16.setOnClickListener(v -> switchSplitMode(SplitMode.SIXTEEN));
        
        // 控制按钮
        mBtnStartAll.setOnClickListener(v -> startAllPreviews());
        mBtnStopAll.setOnClickListener(v -> stopAllPreviews());
        mBtnRefreshDevices.setOnClickListener(v -> refreshDeviceList());
        mBtnConfigDevices.setOnClickListener(v -> toggleSidebar());
        mBtnRefreshDeviceList.setOnClickListener(v -> refreshDeviceList());
        mBtnApplyConfig.setOnClickListener(v -> applyDeviceConfig());
        mBtnCloseSidebar.setOnClickListener(v -> hideSidebar());
        
    }
    
    private void switchSplitMode(SplitMode mode) {
        if (mCurrentSplitMode == mode) return;
        
        // 停止当前所有预览
        stopAllPreviews();
        
        // 隐藏所有布局
        mSurfaceSingle.setVisibility(View.GONE);
        mLayoutSplit4.setVisibility(View.GONE);
        mLayoutSplit9.setVisibility(View.GONE);
        mLayoutSplit16.setVisibility(View.GONE);
        
        // 显示对应布局
        switch (mode) {
            case SINGLE:
                mSurfaceSingle.setVisibility(View.VISIBLE);
                break;
            case FOUR:
                mLayoutSplit4.setVisibility(View.VISIBLE);
                break;
            case NINE:
                mLayoutSplit9.setVisibility(View.VISIBLE);
                break;
            case SIXTEEN:
                mLayoutSplit16.setVisibility(View.VISIBLE);
                break;
        }
        
        // 更新按钮状态
        updateSplitButtonStates(mode);
        mCurrentSplitMode = mode;
        
        // 更新设备配置界面
        updateDeviceConfigUI();
        
        // 如果侧边栏可见，重新创建设备选择器
        if (mSidebarConfig.getVisibility() == View.VISIBLE) {
            setupDeviceConfigSpinners();
        }
        
        // 更新设备信息显示
        updateDeviceInfoDisplay();
        
        // 打印切换前的设备配置状态
        printDeviceConfig("分屏模式切换前");
        
        // 验证当前分屏模式的设备配置
        validateDeviceConfig();
        
        Toast.makeText(getActivity(), "切换到" + mode.getCount() + "分屏模式", Toast.LENGTH_SHORT).show();
    }
    
    private void validateDeviceConfig() {
        int screenCount = mCurrentSplitMode.getCount();
        android.util.Log.d("FragMultiScreenPreview", "=== 验证分屏设备配置 ===");
        android.util.Log.d("FragMultiScreenPreview", "分屏数量: " + screenCount);
        android.util.Log.d("FragMultiScreenPreview", "设备列表大小: " + mDeviceList.size());
        
        int modeIndex = getModeIndex(mCurrentSplitMode);
        for (int i = 0; i < screenCount; i++) {
            DevManageGuider.DeviceItem device = mScreenDeviceConfig[modeIndex][i];
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 设备: " + 
                (device != null ? (device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp) : "未配置"));
        }
        android.util.Log.d("FragMultiScreenPreview", "=== 设备配置验证结束 ===");
    }
    
    private void updateSplitButtonStates(SplitMode selectedMode) {
        mBtnSplit1.setSelected(selectedMode == SplitMode.SINGLE);
        mBtnSplit4.setSelected(selectedMode == SplitMode.FOUR);
        mBtnSplit9.setSelected(selectedMode == SplitMode.NINE);
        mBtnSplit16.setSelected(selectedMode == SplitMode.SIXTEEN);
    }
    
    private void refreshDeviceList() {
        mDeviceList.clear();
        
        // 从数据库加载设备列表
        DBDevice dbDevice = DBDevice.getInstance(getActivity());
        ArrayList<DevManageGuider.DeviceItem> dbDevices = dbDevice.getAllDevices();
        if (dbDevices != null) {
            mDeviceList.addAll(dbDevices);
            android.util.Log.d("FragMultiScreenPreview", "刷新设备列表成功，共 " + dbDevices.size() + " 个设备");
            
            // 更新设备配置界面
            updateDeviceConfigUI();
            
            Toast.makeText(getActivity(), "已加载 " + dbDevices.size() + " 个设备", Toast.LENGTH_SHORT).show();
        } else {
            android.util.Log.w("FragMultiScreenPreview", "从数据库获取设备列表失败");
            Toast.makeText(getActivity(), "没有找到设备，请先添加设备", Toast.LENGTH_SHORT).show();
        }
    }
    
    // 更新设备配置界面
    private void updateDeviceConfigUI() {
        if (mDeviceConfigContainer == null) return;
        
        mDeviceConfigContainer.removeAllViews();
        
        int screenCount = mCurrentSplitMode.getCount();
        for (int i = 0; i < screenCount; i++) {
            createScreenDeviceConfigView(i);
        }
    }
    
    // 为每个分屏创建设备选择界面
    private void createScreenDeviceConfigView(int screenIndex) {
        LinearLayout screenConfigLayout = new LinearLayout(getActivity());
        screenConfigLayout.setOrientation(LinearLayout.VERTICAL);
        screenConfigLayout.setPadding(16, 12, 16, 12);
        
        // 分屏标题
        TextView screenTitle = new TextView(getActivity());
        screenTitle.setText("分屏 " + (screenIndex + 1));
        screenTitle.setTextSize(16);
        screenTitle.setTextColor(getResources().getColor(android.R.color.black));
        screenTitle.setPadding(0, 0, 0, 8);
        screenConfigLayout.addView(screenTitle);
        
        // 设备选择下拉框
        Spinner deviceSpinner = new Spinner(getActivity());
        deviceSpinner.setId(View.generateViewId());
        
        // 创建设备适配器
        List<String> deviceNames = new ArrayList<>();
        deviceNames.add("未选择设备"); // 默认选项
        
        for (DevManageGuider.DeviceItem device : mDeviceList) {
            String deviceName = device.m_szDevName;
            if (deviceName == null || deviceName.trim().isEmpty()) {
                deviceName = "设备_" + device.m_struNetInfo.m_szIp;
            }
            deviceNames.add(deviceName + " (" + device.m_struNetInfo.m_szIp + ")");
        }
        
        ArrayAdapter<String> adapter = new ArrayAdapter<>(getActivity(), 
            android.R.layout.simple_spinner_item, deviceNames);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        deviceSpinner.setAdapter(adapter);
        
        // 设置当前选中的设备
        DevManageGuider.DeviceItem selectedDevice = mScreenDeviceConfig[getModeIndex(mCurrentSplitMode)][screenIndex];
        if (selectedDevice != null) {
            int deviceIndex = mDeviceList.indexOf(selectedDevice);
            if (deviceIndex >= 0) {
                deviceSpinner.setSelection(deviceIndex + 1); // +1 因为有"未选择设备"选项
            }
        }
        
        // 设置选择监听器
        final int modeIndex = getModeIndex(mCurrentSplitMode);
        final int finalScreenIndex = screenIndex; // 用于内部类访问
        
        deviceSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    // 未选择设备，停止预览
                    if (mPreviewHandles[modeIndex][finalScreenIndex] != -1) {
                        stopPreview(modeIndex, finalScreenIndex);
                    }
                    mScreenDeviceConfig[modeIndex][finalScreenIndex] = null;
                    updateDeviceInfoDisplay();
                } else {
                    // 选择了设备，立即开始预览
                    int deviceIndex = position - 1;
                    if (deviceIndex < mDeviceList.size()) {
                        DevManageGuider.DeviceItem selectedDevice = mDeviceList.get(deviceIndex);
                        mScreenDeviceConfig[modeIndex][finalScreenIndex] = selectedDevice;
                        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (finalScreenIndex + 1) + " 选择设备: " + 
                            selectedDevice.m_szDevName);
                        
                        // 更新设备信息显示
                        updateDeviceInfoDisplay();
                        
                        // 先停止当前预览（如果有）
                        if (mPreviewHandles[modeIndex][finalScreenIndex] != -1) {
                            stopPreview(modeIndex, finalScreenIndex);
                        }
                        
                        // 立即开始预览
                        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (finalScreenIndex + 1) + " 立即开始预览设备: " + selectedDevice.m_szDevName);
                        startPreviewWithDevice(modeIndex, finalScreenIndex, selectedDevice);
                    }
                }
            }
            
            @Override
            public void onNothingSelected(AdapterView<?> parent) {
                // 不做处理
            }
        });
        
        screenConfigLayout.addView(deviceSpinner);
        
        // 添加分隔线
        View divider = new View(getActivity());
        divider.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 1));
        divider.setBackgroundColor(getResources().getColor(android.R.color.darker_gray));
        screenConfigLayout.addView(divider);
        
        mDeviceConfigContainer.addView(screenConfigLayout);
    }
    
    // 更新设备信息显示
    private void updateDeviceInfoDisplay() {
        int modeIndex = getModeIndex(mCurrentSplitMode);
        int maxCount = mCurrentSplitMode.getCount();
        
        android.util.Log.d("FragMultiScreenPreview", "=== 更新设备信息显示 ===");
        android.util.Log.d("FragMultiScreenPreview", "模式索引: " + modeIndex + ", 分屏数量: " + maxCount);
        
        for (int i = 0; i < maxCount; i++) {
            TextView deviceInfoView = mDeviceInfoTextViews[modeIndex][i];
            if (deviceInfoView != null) {
                DevManageGuider.DeviceItem device = mScreenDeviceConfig[modeIndex][i];
                if (device != null) {
                    String deviceName = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
                    String status = device.m_struDevState.m_iLogState == 1 ? "在线" : "离线";
                    String displayText = deviceName + "\n" + status;
                    deviceInfoView.setText(displayText);
                    deviceInfoView.setVisibility(View.VISIBLE);
                    android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 显示设备信息: " + displayText);
                } else {
                    deviceInfoView.setText("未配置设备");
                    deviceInfoView.setVisibility(View.VISIBLE);
                    android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 显示: 未配置设备");
                }
            } else {
                android.util.Log.w("FragMultiScreenPreview", "分屏 " + (i + 1) + " 设备信息TextView为null");
            }
        }
        android.util.Log.d("FragMultiScreenPreview", "=== 设备信息显示更新完成 ===");
    }
    
    private void startAllPreviews() {
        if (mDeviceList.isEmpty()) {
            Toast.makeText(getActivity(), "没有可用设备，请先刷新设备列表", Toast.LENGTH_SHORT).show();
            return;
        }
        
        int modeIndex = getModeIndex(mCurrentSplitMode);
        int maxCount = mCurrentSplitMode.getCount();
        
        android.util.Log.d("FragMultiScreenPreview", "=== 开始预览调试信息 ===");
        android.util.Log.d("FragMultiScreenPreview", "当前分屏模式: " + mCurrentSplitMode + ", 分屏数量: " + maxCount);
        android.util.Log.d("FragMultiScreenPreview", "模式索引: " + modeIndex);
        
        // 打印当前设备配置状态
        for (int i = 0; i < maxCount; i++) {
            DevManageGuider.DeviceItem device = mScreenDeviceConfig[modeIndex][i];
            String deviceInfo = device != null ? 
                (device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp) + 
                " (IP: " + device.m_struNetInfo.m_szIp + ", UserID: " + device.m_lUserID + ")" : 
                "未配置";
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 配置设备: " + deviceInfo);
        }
        
        // 在后台线程中启动预览，避免阻塞主线程
        new Thread(new Runnable() {
            @Override
            public void run() {
                final int[] configuredScreens = {0}; // 使用数组来避免final限制
                
                for (int i = 0; i < maxCount; i++) {
                    DevManageGuider.DeviceItem device = mScreenDeviceConfig[modeIndex][i];
                    if (device != null) {
                        String deviceName = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
                        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 使用设备: " + deviceName);
                        
                        final int finalI = i;
                        final DevManageGuider.DeviceItem finalDevice = device;
                        
                        // 每个预览在单独的线程中启动，避免相互阻塞
                        new Thread(new Runnable() {
                            @Override
                            public void run() {
                                if (getActivity() != null) {
                                    getActivity().runOnUiThread(new Runnable() {
                                        @Override
                                        public void run() {
                                            startPreviewWithDevice(modeIndex, finalI, finalDevice);
                                        }
                                    });
                                }
                            }
                        }).start();
                        
                        configuredScreens[0]++;
                        
                        // 添加小延迟，避免同时启动太多预览
                        try {
                            Thread.sleep(200);
                        } catch (InterruptedException e) {
                            android.util.Log.e("FragMultiScreenPreview", "启动预览时被中断", e);
                            break;
                        }
                    } else {
                        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 未配置设备");
                    }
                }
                
                // 在主线程中显示配置状态
                if (getActivity() != null) {
                    getActivity().runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (configuredScreens[0] == 0) {
                                Toast.makeText(getActivity(), "没有配置任何设备，请先配置分屏设备", Toast.LENGTH_LONG).show();
                            } else if (configuredScreens[0] < maxCount) {
                                Toast.makeText(getActivity(), "正在启动 " + configuredScreens[0] + "/" + maxCount + " 个分屏预览...", Toast.LENGTH_SHORT).show();
                            } else {
                                Toast.makeText(getActivity(), "正在启动所有分屏预览...", Toast.LENGTH_SHORT).show();
                            }
                        }
                    });
                }
            }
        }).start();
    }
    
    // 使用指定设备开始预览
    private void startPreviewWithDevice(int modeIndex, int surfaceIndex, DevManageGuider.DeviceItem device) {
        SurfaceView surfaceView = mSurfaceViews[modeIndex][surfaceIndex];
        if (surfaceView == null) return;
        
        String deviceName = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 开始预览设备: " + deviceName + " (UserID: " + device.m_lUserID + ")");
        
        // 检查设备是否已登录
        if (device.m_struDevState.m_iLogState != 1) {
            android.util.Log.d("FragMultiScreenPreview", "设备 " + deviceName + " 未登录，在后台线程中尝试自动登录");
            
            // 在后台线程中执行设备登录，避免阻塞主线程
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // 保存当前选中的设备索引，避免影响其他分屏
                        int originalSelectedIndex = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex();
                        
                        // 尝试登录设备（设置超时机制）
                        boolean loginSuccess = false;
                        try {
                            // 确保使用正确的设备信息进行登录
                            android.util.Log.d("FragMultiScreenPreview", "设备 " + deviceName + " 开始登录，IP: " + device.m_struNetInfo.m_szIp);
                            
                            // 使用超时机制，避免长时间阻塞
                            loginSuccess = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                                device.m_szDevName, device.m_struNetInfo);
                                
                            android.util.Log.d("FragMultiScreenPreview", "设备 " + deviceName + " 登录结果: " + loginSuccess);
                        } catch (Exception e) {
                            android.util.Log.e("FragMultiScreenPreview", "设备 " + deviceName + " 登录异常", e);
                            loginSuccess = false;
                        }
                        
                        if (!loginSuccess) {
                            int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
                            String errorMessage = getErrorMessage(errorCode);
                            android.util.Log.e("FragMultiScreenPreview", "设备 " + deviceName + " 登录失败: " + errorCode + " - " + errorMessage);
                            
                            // 在主线程中显示错误提示
                            if (getActivity() != null) {
                                getActivity().runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        Toast.makeText(getActivity(), "设备 " + deviceName + " 登录失败: " + errorMessage, Toast.LENGTH_LONG).show();
                                    }
                                });
                            }
                            return;
                        }
                        
                        // 登录成功后，更新设备信息（根据IP/端口/用户名匹配刚登录的设备）
                        int matchedIndex = -1;
                        java.util.ArrayList<DevManageGuider.DeviceItem> guiderList = SDKGuider.g_sdkGuider.m_comDMGuider.getDevList();
                        if (guiderList != null && device.m_struNetInfo != null) {
                            for (int idx = guiderList.size() - 1; idx >= 0; idx--) {
                                DevManageGuider.DeviceItem it = guiderList.get(idx);
                                if (it != null && it.m_struNetInfo != null) {
                                    boolean ipEq = device.m_struNetInfo.m_szIp != null && device.m_struNetInfo.m_szIp.equals(it.m_struNetInfo.m_szIp);
                                    boolean portEq = device.m_struNetInfo.m_szPort != null && device.m_struNetInfo.m_szPort.equals(it.m_struNetInfo.m_szPort);
                                    boolean userEq = device.m_struNetInfo.m_szUserName != null && device.m_struNetInfo.m_szUserName.equals(it.m_struNetInfo.m_szUserName);
                                    if (ipEq && portEq && userEq) {
                                        matchedIndex = idx;
                                        break;
                                    }
                                }
                            }
                        }

                        DevManageGuider.DeviceItem loggedInDevice = null;
                        if (matchedIndex >= 0) {
                            SDKGuider.g_sdkGuider.m_comDMGuider.setCurrSelectDevIndex(matchedIndex);
                            loggedInDevice = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                        } else {
                            // 兜底：使用当前选中设备（可能不准确，但不阻断流程）
                            loggedInDevice = SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev();
                        }
                        if (loggedInDevice != null) {
                            // 更新设备信息，确保使用正确的UserID
                            device.m_lUserID = loggedInDevice.m_lUserID;
                            device.m_struDevState.m_iLogState = loggedInDevice.m_struDevState.m_iLogState;
                            android.util.Log.d("FragMultiScreenPreview", "设备 " + deviceName + " 登录成功，UserID: " + device.m_lUserID +
                                ", 登录状态: " + device.m_struDevState.m_iLogState + ", 匹配索引: " + matchedIndex);
                            if (device.m_lUserID == -1) {
                                android.util.Log.e("FragMultiScreenPreview", "设备 " + deviceName + " UserID无效，登录可能失败");
                            }
                        } else {
                            android.util.Log.e("FragMultiScreenPreview", "设备 " + deviceName + " 登录后获取信息失败");
                        }
                        
                        // 恢复原来的选中设备索引，避免影响其他分屏
                        SDKGuider.g_sdkGuider.m_comDMGuider.setCurrSelectDevIndex(originalSelectedIndex);
                        android.util.Log.d("FragMultiScreenPreview", "设备 " + deviceName + " 登录完成，恢复原选中设备索引: " + originalSelectedIndex);
                        
                        // 登录成功后，在主线程中开始预览
                        if (getActivity() != null) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    startPreviewAfterLogin(modeIndex, surfaceIndex, device);
                                }
                            });
                        }
                    } catch (Exception e) {
                        android.util.Log.e("FragMultiScreenPreview", "设备 " + deviceName + " 登录过程中发生异常", e);
                        if (getActivity() != null) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(getActivity(), "设备 " + deviceName + " 登录异常: " + e.getMessage(), Toast.LENGTH_LONG).show();
                                }
                            });
                        }
                    }
                }
            }).start();
            return;
        }
        
        // 设备已登录，直接开始预览
        startPreviewAfterLogin(modeIndex, surfaceIndex, device);
    }
    
    private void stopAllPreviews() {
        int modeIndex = getModeIndex(mCurrentSplitMode);
        int maxCount = mCurrentSplitMode.getCount();
        
        for (int i = 0; i < maxCount; i++) {
            stopPreview(modeIndex, i);
        }
        
        Toast.makeText(getActivity(), "停止所有预览", Toast.LENGTH_SHORT).show();
    }
    
    private void startPreviewAfterLogin(int modeIndex, int surfaceIndex, DevManageGuider.DeviceItem device) {
        SurfaceView surfaceView = mSurfaceViews[modeIndex][surfaceIndex];
        if (surfaceView == null) {
            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " SurfaceView为null");
            return;
        }
        
        String deviceName = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 开始预览设备: " + deviceName + " (UserID: " + device.m_lUserID + ")");
        
        // 验证设备UserID是否有效
        if (device.m_lUserID == -1) {
            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 设备 " + deviceName + " UserID无效，无法启动预览");
            return;
        }
        
        // 验证设备登录状态
        if (device.m_struDevState.m_iLogState != 1) {
            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 设备 " + deviceName + " 未登录，无法启动预览");
            return;
        }
        
        // 验证Surface是否已准备好
        SurfaceHolder holder = surfaceView.getHolder();
        if (holder == null) {
            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " SurfaceHolder为null");
            return;
        }
        
        // 检查Surface是否有效
        if (holder.getSurface() == null || !holder.getSurface().isValid()) {
            android.util.Log.w("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " Surface尚未准备好，等待surfaceCreated回调");
            android.util.Log.w("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 设备将会在Surface创建后自动启动预览");
            // 不立即启动预览，等待surfaceCreated回调时自动启动
            // 但是保留配置信息，以便surfaceCreated时可以找到
            return;
        }
        
        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " Surface已准备好，可以启动预览");
        
        // 如果已经在预览，先停止
        if (mPreviewHandles[modeIndex][surfaceIndex] != -1) {
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 已经在预览，先停止");
            stopPreview(modeIndex, surfaceIndex);
        }
        
        // 开始预览 - 直接使用设备的UserID，不依赖SDK的当前设备设置
        NET_DVR_PREVIEWINFO previewInfo = new NET_DVR_PREVIEWINFO();
        previewInfo.lChannel = computeChannelForScreen(modeIndex, surfaceIndex, device); // 通道号
        previewInfo.dwStreamType = mCurrentStreamType; // 码流类型
        previewInfo.dwLinkMode = 0; // 连接模式
        previewInfo.bBlocked = 0; // 非阻塞取流，避免ANR
        previewInfo.hHwnd = surfaceView.getHolder();
        
        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 启动预览，UserID: " + device.m_lUserID + 
            ", IP: " + device.m_struNetInfo.m_szIp + ", 通道: " + previewInfo.lChannel);
        
        int handle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(
            device.m_lUserID, previewInfo, null);
        
        if (handle != -1) {
            mPreviewHandles[modeIndex][surfaceIndex] = handle;
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 设备 " + deviceName + " 预览开始，句柄: " + handle);
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 使用UserID: " + device.m_lUserID + 
                ", IP: " + device.m_struNetInfo.m_szIp);
        } else {
            int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (surfaceIndex + 1) + " 设备 " + deviceName + " 预览失败: " + errorCode);
        }
    }

    // 计算当前分屏使用的通道号：
    // 若同一设备在多个分屏中被选择，则按出现次数自动分配 1、2、3... 通道；
    // 若能获取到设备信息结构，可根据需要扩展为以起始通道为基准（此处默认从1开始）。
    private int computeChannelForScreen(int modeIndex, int surfaceIndex, DevManageGuider.DeviceItem device) {
        if (device == null) return 1;
        int occurrence = 0;
        int screenCount = mCurrentSplitMode.getCount();
        for (int i = 0; i < screenCount && i <= surfaceIndex; i++) {
            if (mScreenDeviceConfig[modeIndex][i] == device) {
                occurrence++;
            }
        }
        int channelBase = 1;
        try {
            // 如需要，可在此处读取 device.m_struDeviceInfoV40_jna.struDeviceV30.byStartChan/byStartDChan
            // 目前多数设备通道从1起，此处保持简单可靠
            channelBase = 1;
        } catch (Exception ignored) {}
        int channel = channelBase + Math.max(occurrence - 1, 0);
        if (channel <= 0) channel = 1;
        return channel;
    }
    
    private void stopPreview(int modeIndex, int surfaceIndex) {
        if (mPreviewHandles[modeIndex][surfaceIndex] != -1) {
            SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(mPreviewHandles[modeIndex][surfaceIndex]);
            mPreviewHandles[modeIndex][surfaceIndex] = -1;
        }
    }
    
    private int getModeIndex(SplitMode mode) {
        switch (mode) {
            case SINGLE: return 0;
            case FOUR: return 1;
            case NINE: return 2;
            case SIXTEEN: return 3;
            default: return 0;
        }
    }
    
    // SurfaceHolder.Callback实现
    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        holder.setFormat(PixelFormat.OPAQUE);
        
        android.util.Log.d("FragMultiScreenPreview", "=== surfaceCreated ===");
        android.util.Log.d("FragMultiScreenPreview", "当前分屏模式: " + mCurrentSplitMode + ", 模式索引: " + getModeIndex(mCurrentSplitMode));
        
        // 查找对应的SurfaceView，并在主线程中启动预览
        for (int mode = 0; mode < 4; mode++) {
            int maxCount = (mode == 0) ? 1 : (mode == 1) ? 4 : (mode == 2) ? 9 : 16;
            for (int i = 0; i < maxCount; i++) {
                if (mSurfaceViews[mode][i] != null && mSurfaceViews[mode][i].getHolder() == holder) {
                    final int modeIndex = mode;
                    final int surfaceIndex = i;
                    
                    android.util.Log.d("FragMultiScreenPreview", "surfaceCreated - 找到对应SurfaceView: 模式=" + mode + ", 索引=" + i);
                    android.util.Log.d("FragMultiScreenPreview", "surfaceCreated - 当前模式索引: " + getModeIndex(mCurrentSplitMode));
                    android.util.Log.d("FragMultiScreenPreview", "surfaceCreated - 设备配置: " + (mScreenDeviceConfig[mode][i] == null ? "无" : "有"));
                    
                    // 如果是当前分屏模式且已配置设备，启动预览
                    if (mode == getModeIndex(mCurrentSplitMode) && mScreenDeviceConfig[mode][i] != null) {
                        final DevManageGuider.DeviceItem device = mScreenDeviceConfig[mode][i];
                        
                        android.util.Log.d("FragMultiScreenPreview", "surfaceCreated - 设备: " + 
                            (device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp) + 
                            ", UserID: " + device.m_lUserID);
                        
                        // 在主线程中启动预览
                        if (getActivity() != null) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    android.util.Log.d("FragMultiScreenPreview", "surfaceCreated后启动预览 - 分屏: " + (surfaceIndex + 1));
                                    startPreviewWithDevice(modeIndex, surfaceIndex, device);
                                }
                            });
                        }
                    } else {
                        android.util.Log.w("FragMultiScreenPreview", "surfaceCreated - 条件不满足，无法启动预览");
                        android.util.Log.w("FragMultiScreenPreview", "  模式匹配: " + (mode == getModeIndex(mCurrentSplitMode)) + 
                            " (mode=" + mode + ", 当前=" + getModeIndex(mCurrentSplitMode) + ")");
                        android.util.Log.w("FragMultiScreenPreview", "  设备配置: " + (mScreenDeviceConfig[mode][i] == null ? "无" : "有"));
                    }
                    return;
                }
            }
        }
        android.util.Log.w("FragMultiScreenPreview", "surfaceCreated - 未找到对应的SurfaceView");
    }
    
    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
        // Surface尺寸改变时，可能需要重启预览
        android.util.Log.d("FragMultiScreenPreview", "surfaceChanged - width: " + width + ", height: " + height);
        
        // 查找对应的SurfaceView
        for (int mode = 0; mode < 4; mode++) {
            int maxCount = (mode == 0) ? 1 : (mode == 1) ? 4 : (mode == 2) ? 9 : 16;
            for (int i = 0; i < maxCount; i++) {
                if (mSurfaceViews[mode][i] != null && mSurfaceViews[mode][i].getHolder() == holder) {
                    final int modeIndex = mode;
                    final int surfaceIndex = i;
                    
                    // 如果是当前分屏模式且已配置设备且已经在预览中，重启预览
                    if (mode == getModeIndex(mCurrentSplitMode) && mScreenDeviceConfig[mode][i] != null && mPreviewHandles[modeIndex][surfaceIndex] != -1) {
                        // 只有在已经在预览时才重启
                        android.util.Log.d("FragMultiScreenPreview", "surfaceChanged - 分屏 " + (surfaceIndex + 1) + " 已在预览，重启预览");
                        
                        // 停止当前预览
                        stopPreview(modeIndex, surfaceIndex);
                        
                        final DevManageGuider.DeviceItem device = mScreenDeviceConfig[mode][i];
                        
                        // 重启预览
                        if (getActivity() != null) {
                            getActivity().runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    android.util.Log.d("FragMultiScreenPreview", "surfaceChanged后重启预览 - 分屏: " + (surfaceIndex + 1));
                                    startPreviewWithDevice(modeIndex, surfaceIndex, device);
                                }
                            });
                        }
                    }
                    return;
                }
            }
        }
    }
    
    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        // Surface销毁时停止预览
        android.util.Log.d("FragMultiScreenPreview", "surfaceDestroyed");
        
        // 查找对应的SurfaceView并停止预览
        for (int mode = 0; mode < 4; mode++) {
            int maxCount = (mode == 0) ? 1 : (mode == 1) ? 4 : (mode == 2) ? 9 : 16;
            for (int i = 0; i < maxCount; i++) {
                if (mSurfaceViews[mode][i] != null && mSurfaceViews[mode][i].getHolder() == holder) {
                    int modeIndex = mode;
                    int surfaceIndex = i;
                    
                    android.util.Log.d("FragMultiScreenPreview", "surfaceDestroyed - 分屏模式: " + mode + ", 分屏索引: " + i);
                    stopPreview(modeIndex, surfaceIndex);
                    return;
                }
            }
        }
    }
    
    // 侧边栏相关方法
    private void toggleSidebar() {
        if (mSidebarConfig.getVisibility() == View.VISIBLE) {
            hideSidebar();
        } else {
            showSidebar();
        }
    }
    
    private void showSidebar() {
        mSidebarConfig.setVisibility(View.VISIBLE);
        setupDeviceConfigSpinners();
    }
    
    private void hideSidebar() {
        mSidebarConfig.setVisibility(View.GONE);
    }
    
    private void setupDeviceConfigSpinners() {
        mDeviceConfigContainer.removeAllViews();
        int screenCount = mCurrentSplitMode.getCount();
        mScreenDeviceSpinners = new Spinner[screenCount];
        
        for (int i = 0; i < screenCount; i++) {
            // 创建设备配置项
            LinearLayout configItem = new LinearLayout(getActivity());
            configItem.setOrientation(LinearLayout.HORIZONTAL);
            configItem.setPadding(0, 8, 0, 8);
            
            // 分屏标签
            TextView label = new TextView(getActivity());
            label.setText("分屏 " + (i + 1) + ":");
            label.setTextSize(14);
            label.setTextColor(getResources().getColor(R.color.primary_text));
            label.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            
            // 设备选择器
            Spinner spinner = new Spinner(getActivity());
            spinner.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2));
            
            // 创建设备适配器
            ArrayAdapter<String> adapter = new ArrayAdapter<>(getActivity(), 
                android.R.layout.simple_spinner_item, new ArrayList<String>());
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
            
            // 添加设备选项
            adapter.add("无设备");
            for (DevManageGuider.DeviceItem device : mDeviceList) {
                // 处理设备名称为null或空的情况
                String deviceName = device.m_szDevName;
                if (deviceName == null || deviceName.trim().isEmpty()) {
                    deviceName = "设备_" + device.m_struNetInfo.m_szIp;
                }
                adapter.add(deviceName + " (" + device.m_struNetInfo.m_szIp + ")");
            }
            
            spinner.setAdapter(adapter);
            // 设置选择项：如果未配置（null）则选择"无设备"（索引0），否则选择对应设备（索引+1）
            int modeIndex = getModeIndex(mCurrentSplitMode);
            DevManageGuider.DeviceItem selectedDevice = mScreenDeviceConfig[modeIndex][i];
            int selectionIndex = selectedDevice == null ? 0 : mDeviceList.indexOf(selectedDevice) + 1;
            spinner.setSelection(selectionIndex);
            
            // 设置选择监听器
            final int screenIndex = i; // 用于内部类访问
            spinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                @Override
                public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                    android.util.Log.d("FragMultiScreenPreview", "分屏 " + (screenIndex + 1) + " 设备选择器触发，位置: " + position);
                    
                    if (position == 0) {
                        // 未选择设备，停止预览
                        if (mPreviewHandles[modeIndex][screenIndex] != -1) {
                            stopPreview(modeIndex, screenIndex);
                        }
                        mScreenDeviceConfig[modeIndex][screenIndex] = null;
                        android.util.Log.d("FragMultiScreenPreview", "分屏 " + (screenIndex + 1) + " 取消选择设备");
                        updateDeviceInfoDisplay();
                    } else {
                        // 选择了设备，立即开始预览
                        int deviceIndex = position - 1;
                        if (deviceIndex < mDeviceList.size()) {
                            DevManageGuider.DeviceItem selectedDevice = mDeviceList.get(deviceIndex);
                            mScreenDeviceConfig[modeIndex][screenIndex] = selectedDevice;
                            String deviceName = selectedDevice.m_szDevName != null ? selectedDevice.m_szDevName : "设备_" + selectedDevice.m_struNetInfo.m_szIp;
                            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (screenIndex + 1) + " 选择设备: " + deviceName + 
                                " (IP: " + selectedDevice.m_struNetInfo.m_szIp + ", UserID: " + selectedDevice.m_lUserID + ")");
                            
                            // 立即更新设备信息显示
                            updateDeviceInfoDisplay();
                            
                            // 先停止当前预览（如果有）
                            if (mPreviewHandles[modeIndex][screenIndex] != -1) {
                                stopPreview(modeIndex, screenIndex);
                            }
                            
                            // 立即开始预览
                            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (screenIndex + 1) + " 立即开始预览设备: " + deviceName);
                            startPreviewWithDevice(modeIndex, screenIndex, selectedDevice);
                        } else {
                            android.util.Log.e("FragMultiScreenPreview", "分屏 " + (screenIndex + 1) + " 设备索引超出范围: " + deviceIndex);
                        }
                    }
                }
                
                @Override
                public void onNothingSelected(AdapterView<?> parent) {
                    // 不做处理
                }
            });
            
            configItem.addView(label);
            configItem.addView(spinner);
            mDeviceConfigContainer.addView(configItem);
            
            mScreenDeviceSpinners[i] = spinner;
        }
    }
    
    private void applyDeviceConfig() {
        if (mScreenDeviceSpinners == null) return;
        
        int screenCount = mCurrentSplitMode.getCount();
        
        // 检查数组大小是否匹配当前分屏模式
        if (mScreenDeviceSpinners.length != screenCount) {
            android.util.Log.w("FragMultiScreenPreview", "设备选择器数组大小不匹配，重新创建");
            setupDeviceConfigSpinners();
            return; // 重新创建后，用户需要重新点击应用按钮
        }
        
        // 停止所有预览
        stopAllPreviews();
        
        // 更新设备配置
        android.util.Log.d("FragMultiScreenPreview", "=== 应用设备配置 ===");
        android.util.Log.d("FragMultiScreenPreview", "当前分屏模式: " + mCurrentSplitMode + ", 分屏数量: " + screenCount);
        android.util.Log.d("FragMultiScreenPreview", "设备列表大小: " + mDeviceList.size());
        
        int modeIndex = getModeIndex(mCurrentSplitMode);
        for (int i = 0; i < screenCount; i++) {
            int selectedPosition = mScreenDeviceSpinners[i].getSelectedItemPosition();
            int deviceIndex = selectedPosition - 1; // -1因为第一个是"无设备"
            
            String deviceInfo = "无设备";
            if (deviceIndex >= 0 && deviceIndex < mDeviceList.size()) {
                DevManageGuider.DeviceItem device = mDeviceList.get(deviceIndex);
                mScreenDeviceConfig[modeIndex][i] = device;
                deviceInfo = device.m_szDevName != null ? device.m_szDevName : "设备_" + device.m_struNetInfo.m_szIp;
            } else {
                mScreenDeviceConfig[modeIndex][i] = null;
            }
            
            android.util.Log.d("FragMultiScreenPreview", "分屏 " + (i + 1) + " 选择位置: " + selectedPosition + ", 设备索引: " + deviceIndex + ", 设备: " + deviceInfo);
        }
        
        // 打印更新后的配置
        printDeviceConfig("应用配置后");
        
        // 重新开始预览
        // 更新设备信息显示
        updateDeviceInfoDisplay();
        
        startAllPreviews();
        
        Toast.makeText(getActivity(), "设备配置已应用", Toast.LENGTH_SHORT).show();
        hideSidebar();
    }
    
    @Override
    public void onDestroy() {
        stopAllPreviews();
        super.onDestroy();
    }
}

