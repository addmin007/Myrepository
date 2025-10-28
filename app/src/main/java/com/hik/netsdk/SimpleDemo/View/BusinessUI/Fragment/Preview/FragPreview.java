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
    
    // 单台摄像机显示组件
    private SurfaceView mSurfaceSingle;
    private SurfaceHolder mSurfaceHolder;
    private int mPreviewHandle = -1;
    
    // 设备信息显示
    private TextView mDeviceNameView;
    private TextView mDeviceIpDisplay;
    private TextView mConnectionStatus;
    
    // 摄像机控制按钮
    private Button mBtnRefreshCamera;
    private Button mBtnFullscreen;
    
    // 气体浓度
    private TextView mGasConcentrationView;
    
    // 作业人员容器
    private LinearLayout mWorkerContainer;
    
    // 自动连接状态
    private boolean mIsAutoConnecting = false;
    private DevManageGuider.DeviceItem mAutoConnectedDevice = null;
    
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

        // 初始化单台摄像机组件
        initSingleCameraViews(rootView);
        
        // 初始化气体浓度显示
        mGasConcentrationView = rootView.findViewById(R.id.gas_concentration);
        updateGasConcentration();
        
        // 初始化作业人员容器
        mWorkerContainer = rootView.findViewById(R.id.worker_container);
        initWorkers();
        
        // 加载设备并开始预览
        loadDevicesAndStartPreview();
        
        // 立即尝试强制连接
        rootView.post(new Runnable() {
            @Override
            public void run() {
                android.util.Log.d("FragPreview", "Fragment创建完成，立即尝试强制连接设备");
                forceConnectDevice();
            }
        });
        
        checkPermission();
        return rootView;
    }

    private void initSingleCameraViews(View rootView) {
        // 单台摄像机SurfaceView
        mSurfaceSingle = rootView.findViewById(R.id.preview_surface_1);
        
        // 设备信息显示
        mDeviceNameView = rootView.findViewById(R.id.device_name_1);
        mDeviceIpDisplay = rootView.findViewById(R.id.device_ip_display);
        mConnectionStatus = rootView.findViewById(R.id.connection_status);
        
        // 摄像机控制按钮
        mBtnRefreshCamera = rootView.findViewById(R.id.btn_refresh_camera);
        mBtnFullscreen = rootView.findViewById(R.id.btn_fullscreen);
        
        // 设置SurfaceHolder回调
        if (mSurfaceSingle != null) {
            mSurfaceSingle.getHolder().addCallback(this);
            mSurfaceSingle.setZOrderOnTop(false);
            mSurfaceHolder = mSurfaceSingle.getHolder();
        }
        
        // 设置按钮点击事件
        if (mBtnRefreshCamera != null) {
            mBtnRefreshCamera.setOnClickListener(v -> refreshCamera());
        }
        
        if (mBtnFullscreen != null) {
            mBtnFullscreen.setOnClickListener(v -> toggleFullscreen());
        }
    }

    private void loadDevicesAndStartPreview() {
        // 从数据库加载设备
        DBDevice dbDevice = DBDevice.getInstance(getActivity());
        mDeviceList.clear();
        
        ArrayList<DevManageGuider.DeviceItem> dbDevices = dbDevice.getAllDevices();
        android.util.Log.d("FragPreview", "数据库查询结果: " + (dbDevices != null ? dbDevices.size() : "null") + " 个设备");
        
        if (dbDevices != null && !dbDevices.isEmpty()) {
            mDeviceList.addAll(dbDevices);
            android.util.Log.d("FragPreview", "加载到 " + dbDevices.size() + " 个设备");
            
            // 打印设备信息用于调试
            for (int i = 0; i < dbDevices.size(); i++) {
                DevManageGuider.DeviceItem device = dbDevices.get(i);
                android.util.Log.d("FragPreview", "设备 " + i + ": IP=" + device.m_struNetInfo.m_szIp + 
                    ", 端口=" + device.m_struNetInfo.m_szPort + 
                    ", 用户名=" + device.m_struNetInfo.m_szUserName + 
                    ", 登录状态=" + device.m_struDevState.m_iLogState);
            }
            
            // 延迟一下确保SurfaceView已经初始化完成
            if (mSurfaceSingle != null) {
                mSurfaceSingle.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        // 自动连接第一个设备
                        autoConnectFirstDevice();
                    }
                }, 500);
            }
        } else {
            android.util.Log.d("FragPreview", "没有找到设备，尝试创建默认设备");
            updateConnectionStatus("无设备", false);
            
            // 如果没有设备，创建一个默认设备用于测试
            createDefaultDevice();
        }
    }
    
    // 创建默认设备（用于测试）
    private void createDefaultDevice() {
        android.util.Log.d("FragPreview", "创建默认设备");
        
        // 通过DevManageGuider实例创建DeviceItem
        DevManageGuider devManageGuider = SDKGuider.g_sdkGuider.m_comDMGuider;
        DevManageGuider.DeviceItem defaultDevice = devManageGuider.new DeviceItem();
        
        // 初始化网络信息对象
        defaultDevice.m_struNetInfo = devManageGuider.new DevNetInfo();
        
        // 设置设备网络信息
        defaultDevice.m_struNetInfo.m_szIp = "192.168.8.110";  // 从图片中看到的IP地址
        defaultDevice.m_struNetInfo.m_szPort = "8000";  // 默认端口
        defaultDevice.m_struNetInfo.m_szUserName = "admin";  // 默认用户名
        defaultDevice.m_struNetInfo.m_szPassword = "admin123";  // 默认密码
        
        // 设置设备名称
        defaultDevice.m_szDevName = "默认摄像机";
        
        // 设置设备状态
        defaultDevice.m_struDevState.m_iLogState = 0;  // 未登录状态
        defaultDevice.m_lUserID = -1;  // 未登录
        
        // 验证网络信息
        boolean isValidNetInfo = defaultDevice.m_struNetInfo.checkNetInfo();
        android.util.Log.d("FragPreview", "网络信息验证结果: " + isValidNetInfo);
        android.util.Log.d("FragPreview", "IP验证: " + defaultDevice.m_struNetInfo.checkIp());
        android.util.Log.d("FragPreview", "端口验证: " + defaultDevice.m_struNetInfo.checkPort());
        android.util.Log.d("FragPreview", "用户名非空: " + !defaultDevice.m_struNetInfo.m_szUserName.isEmpty());
        android.util.Log.d("FragPreview", "密码非空: " + !defaultDevice.m_struNetInfo.m_szPassword.isEmpty());
        
        // 添加到设备列表
        mDeviceList.add(defaultDevice);
        
        android.util.Log.d("FragPreview", "默认设备创建完成: IP=" + defaultDevice.m_struNetInfo.m_szIp + 
            ", 端口=" + defaultDevice.m_struNetInfo.m_szPort + 
            ", 用户名=" + defaultDevice.m_struNetInfo.m_szUserName);
        
        // 延迟一下确保SurfaceView已经初始化完成
        if (mSurfaceSingle != null) {
            mSurfaceSingle.postDelayed(new Runnable() {
                @Override
                public void run() {
                    // 自动连接默认设备
                    autoConnectFirstDevice();
                }
            }, 500);
        }
    }

    // 自动连接第一个设备
    private void autoConnectFirstDevice() {
        if (mIsAutoConnecting) {
            android.util.Log.d("FragPreview", "自动连接已在进行中，跳过");
            return;
        }
        
        if (mDeviceList.isEmpty()) {
            android.util.Log.w("FragPreview", "设备列表为空，无法自动连接");
            updateConnectionStatus("无设备", false);
            return;
        }
        
        DevManageGuider.DeviceItem firstDevice = mDeviceList.get(0);
        String deviceName = firstDevice.m_szDevName != null ? firstDevice.m_szDevName : "设备_" + firstDevice.m_struNetInfo.m_szIp;
        
        android.util.Log.d("FragPreview", "开始自动连接设备: " + deviceName);
        android.util.Log.d("FragPreview", "设备信息: IP=" + firstDevice.m_struNetInfo.m_szIp + 
            ", 端口=" + firstDevice.m_struNetInfo.m_szPort + 
            ", 用户名=" + firstDevice.m_struNetInfo.m_szUserName + 
            ", 当前登录状态=" + firstDevice.m_struDevState.m_iLogState);
        
        updateConnectionStatus("正在连接 " + deviceName + "...", false);
        
        mIsAutoConnecting = true;
        
        // 在后台线程中执行自动连接
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    // 检查设备是否已登录
                    if (firstDevice.m_struDevState.m_iLogState != 1) {
                        android.util.Log.d("FragPreview", "设备 " + deviceName + " 未登录，尝试自动登录");
                        
                        // 验证网络信息
                        boolean isValidNetInfo = firstDevice.m_struNetInfo.checkNetInfo();
                        android.util.Log.d("FragPreview", "登录前网络信息验证: " + isValidNetInfo);
                        
                        if (!isValidNetInfo) {
                            android.util.Log.e("FragPreview", "设备网络信息无效，无法登录");
                            if (getActivity() != null) {
                                getActivity().runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        updateConnectionStatus("网络信息无效", false);
                                        mIsAutoConnecting = false;
                                    }
                                });
                            }
                            return;
                        }
                        
                        // 尝试登录设备
                        android.util.Log.d("FragPreview", "开始登录设备: " + deviceName + 
                            ", IP: " + firstDevice.m_struNetInfo.m_szIp + 
                            ", 端口: " + firstDevice.m_struNetInfo.m_szPort + 
                            ", 用户名: " + firstDevice.m_struNetInfo.m_szUserName);
                        
                        boolean loginSuccess = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                            firstDevice.m_szDevName, firstDevice.m_struNetInfo);
                        
                        android.util.Log.d("FragPreview", "设备 " + deviceName + " 登录结果: " + loginSuccess);
                        
                        // 如果登录成功，从DevManageGuider获取UserID
                        if (loginSuccess) {
                            // 从设备列表中查找刚登录的设备（通过IP匹配）
                            ArrayList<DevManageGuider.DeviceItem> deviceList = SDKGuider.g_sdkGuider.m_comDMGuider.getDevList();
                            DevManageGuider.DeviceItem loggedInDevice = null;
                            
                            // 查找刚登录的设备（通过IP匹配）
                            for (DevManageGuider.DeviceItem device : deviceList) {
                                if (device.m_struNetInfo != null && 
                                    device.m_struNetInfo.m_szIp.equals(firstDevice.m_struNetInfo.m_szIp) &&
                                    device.m_lUserID != -1) {
                                    loggedInDevice = device;
                                    break;
                                }
                            }
                            
                            if (loggedInDevice != null) {
                                firstDevice.m_lUserID = loggedInDevice.m_lUserID;
                                firstDevice.m_struDevState.m_iLogState = loggedInDevice.m_struDevState.m_iLogState;
                                firstDevice.m_struDeviceInfoV40_jna = loggedInDevice.m_struDeviceInfoV40_jna;
                                android.util.Log.d("FragPreview", "从设备列表获取UserID: " + firstDevice.m_lUserID);
                            } else {
                                android.util.Log.w("FragPreview", "无法从设备列表获取UserID，尝试其他方法");
                            }
                        }
                        
                        if (!loginSuccess) {
                            int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
                            android.util.Log.e("FragPreview", "设备 " + deviceName + " 自动登录失败: " + errorCode);
                            
                            // 尝试不同的用户名密码组合
                            android.util.Log.d("FragPreview", "尝试其他用户名密码组合");
                            String[] usernames = {"admin", "root", "user"};
                            String[] passwords = {"admin123", "admin", "12345", "password", ""};
                            
                            boolean retrySuccess = false;
                            for (String username : usernames) {
                                for (String password : passwords) {
                                    firstDevice.m_struNetInfo.m_szUserName = username;
                                    firstDevice.m_struNetInfo.m_szPassword = password;
                                    
                                    android.util.Log.d("FragPreview", "重试登录: " + username + "/" + password);
                                    boolean retryResult = SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(
                                        firstDevice.m_szDevName, firstDevice.m_struNetInfo);
                                    
                                    if (retryResult) {
                                        android.util.Log.d("FragPreview", "重试登录成功: " + username + "/" + password);
                                        loginSuccess = true;
                                        retrySuccess = true;
                                        
                                        // 重试登录成功后，也需要获取UserID
                                        ArrayList<DevManageGuider.DeviceItem> deviceList = SDKGuider.g_sdkGuider.m_comDMGuider.getDevList();
                                        for (DevManageGuider.DeviceItem device : deviceList) {
                                            if (device.m_struNetInfo != null && 
                                                device.m_struNetInfo.m_szIp.equals(firstDevice.m_struNetInfo.m_szIp) &&
                                                device.m_lUserID != -1) {
                                                firstDevice.m_lUserID = device.m_lUserID;
                                                firstDevice.m_struDevState.m_iLogState = device.m_struDevState.m_iLogState;
                                                firstDevice.m_struDeviceInfoV40_jna = device.m_struDeviceInfoV40_jna;
                                                android.util.Log.d("FragPreview", "重试登录后获取UserID: " + firstDevice.m_lUserID);
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }
                                if (retrySuccess) break;
                            }
                            
                            if (!loginSuccess) {
                                android.util.Log.e("FragPreview", "所有登录尝试都失败");
                                // 在主线程中更新状态
                                if (getActivity() != null) {
                                    getActivity().runOnUiThread(new Runnable() {
                                        @Override
                                        public void run() {
                                            updateConnectionStatus("连接失败 (错误码: " + errorCode + ")", false);
                                            mIsAutoConnecting = false;
                                        }
                                    });
                                }
                                return;
                            }
                        }
                        
                        // 更新设备信息（如果还没有设置）
                        if (firstDevice.m_lUserID == -1) {
                            // 最后一次尝试：从设备列表中查找
                            ArrayList<DevManageGuider.DeviceItem> deviceList = SDKGuider.g_sdkGuider.m_comDMGuider.getDevList();
                            for (DevManageGuider.DeviceItem device : deviceList) {
                                if (device.m_struNetInfo != null && 
                                    device.m_struNetInfo.m_szIp.equals(firstDevice.m_struNetInfo.m_szIp) &&
                                    device.m_lUserID != -1) {
                                    firstDevice.m_lUserID = device.m_lUserID;
                                    firstDevice.m_struDevState.m_iLogState = device.m_struDevState.m_iLogState;
                                    firstDevice.m_struDeviceInfoV40_jna = device.m_struDeviceInfoV40_jna;
                                    android.util.Log.d("FragPreview", "设备 " + deviceName + " 登录成功，UserID: " + firstDevice.m_lUserID);
                                    break;
                                }
                            }
                            
                            if (firstDevice.m_lUserID == -1) {
                                android.util.Log.e("FragPreview", "设备 " + deviceName + " 登录后获取信息失败");
                            }
                        }
                    } else {
                        android.util.Log.d("FragPreview", "设备 " + deviceName + " 已经登录，UserID: " + firstDevice.m_lUserID);
                    }
                    
                    // 在主线程中更新状态并开始预览
                    if (getActivity() != null) {
                        getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                mAutoConnectedDevice = firstDevice;
                                updateConnectionStatus("已连接 " + deviceName, true);
                                updateDeviceInfoDisplay();
                                mIsAutoConnecting = false;
                                
                                // 自动开始预览
                                android.util.Log.d("FragPreview", "自动开始预览设备: " + deviceName);
                                startSingleCameraPreview();
                            }
                        });
                    }
                    
                } catch (Exception e) {
                    android.util.Log.e("FragPreview", "自动连接设备异常", e);
                    if (getActivity() != null) {
                        getActivity().runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                updateConnectionStatus("连接异常: " + e.getMessage(), false);
                                mIsAutoConnecting = false;
                            }
                        });
                    }
                }
            }
        }).start();
    }
    
    // 更新连接状态显示
    private void updateConnectionStatus(String status, boolean isConnected) {
        if (mDeviceNameView != null) {
            mDeviceNameView.setText(status);
        }
        
        if (mConnectionStatus != null) {
            if (isConnected) {
                mConnectionStatus.setText("● 在线");
                mConnectionStatus.setVisibility(View.VISIBLE);
            } else {
                mConnectionStatus.setVisibility(View.GONE);
            }
        }
        
        if (mDeviceIpDisplay != null && mAutoConnectedDevice != null) {
            mDeviceIpDisplay.setText(mAutoConnectedDevice.m_struNetInfo.m_szIp);
        }
    }
    
    // 更新设备信息显示
    private void updateDeviceInfoDisplay() {
        if (mDeviceNameView != null && mAutoConnectedDevice != null) {
            String deviceName = mAutoConnectedDevice.m_szDevName != null ? 
                mAutoConnectedDevice.m_szDevName : "摄像机_" + mAutoConnectedDevice.m_struNetInfo.m_szIp;
            String status = mAutoConnectedDevice.m_struDevState.m_iLogState == 1 ? "在线" : "离线";
            String displayText = deviceName + "\n" + status;
            mDeviceNameView.setText(displayText);
            android.util.Log.d("FragPreview", "摄像机显示信息: " + displayText);
        }
    }

    // 开始单台摄像机预览
    private void startSingleCameraPreview() {
        if (mAutoConnectedDevice == null) {
            android.util.Log.e("FragPreview", "没有已连接的设备");
            return;
        }
        
        String deviceName = mAutoConnectedDevice.m_szDevName != null ? 
            mAutoConnectedDevice.m_szDevName : "摄像机_" + mAutoConnectedDevice.m_struNetInfo.m_szIp;
        android.util.Log.d("FragPreview", "开始预览摄像机: " + deviceName + " (UserID: " + mAutoConnectedDevice.m_lUserID + ")");
        
        // 检查设备是否已登录
        if (mAutoConnectedDevice.m_struDevState.m_iLogState != 1) {
            android.util.Log.e("FragPreview", "摄像机 " + deviceName + " 未登录，无法启动预览");
            updateConnectionStatus("设备未登录", false);
            return;
        }
        
        if (mSurfaceSingle == null || mSurfaceSingle.getHolder() == null) {
            android.util.Log.e("FragPreview", "SurfaceView或Holder为null");
            updateConnectionStatus("SurfaceView未准备好", false);
            return;
        }
        
        // 检查Surface是否有效
        SurfaceHolder holder = mSurfaceSingle.getHolder();
        if (holder.getSurface() == null || !holder.getSurface().isValid()) {
            android.util.Log.w("FragPreview", "Surface尚未准备好，等待surfaceCreated回调");
            updateConnectionStatus("等待Surface准备...", false);
            return;
        }
        
        android.util.Log.d("FragPreview", "Surface已准备好，开始预览");
        
        NET_DVR_PREVIEWINFO previewInfo = new NET_DVR_PREVIEWINFO();
        previewInfo.lChannel = 1; // 通道号
        previewInfo.dwStreamType = 0; // 主码流
        previewInfo.dwLinkMode = 0; // TCP
        previewInfo.bBlocked = 0; // 非阻塞
        previewInfo.hHwnd = mSurfaceSingle.getHolder();
        
        android.util.Log.d("FragPreview", "单台摄像机准备启动预览，UserID: " + mAutoConnectedDevice.m_lUserID + 
            ", IP: " + mAutoConnectedDevice.m_struNetInfo.m_szIp + 
            ", 通道: " + previewInfo.lChannel);
        
        int handle = SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_V40_jni(
            mAutoConnectedDevice.m_lUserID, previewInfo, null);
        
        if (handle != -1) {
            mPreviewHandle = handle;
            android.util.Log.d("FragPreview", "单台摄像机预览成功，句柄: " + handle);
            updateConnectionStatus("预览中", true);
        } else {
            int errorCode = SDKGuider.g_sdkGuider.GetLastError_jni();
            android.util.Log.e("FragPreview", "单台摄像机预览失败，错误代码: " + errorCode);
            updateConnectionStatus("预览失败 (错误码: " + errorCode + ")", false);
        }
    }
    
    // 停止单台摄像机预览
    private void stopSingleCameraPreview() {
        if (mPreviewHandle != -1) {
            SDKGuider.g_sdkGuider.m_comPreviewGuider.RealPlay_Stop_jni(mPreviewHandle);
            mPreviewHandle = -1;
            android.util.Log.d("FragPreview", "单台摄像机预览已停止");
        }
    }
    
    // 强制连接设备
    private void forceConnectDevice() {
        android.util.Log.d("FragPreview", "强制连接设备");
        
        // 停止当前连接
        stopSingleCameraPreview();
        mIsAutoConnecting = false;
        mAutoConnectedDevice = null;
        
        // 创建默认设备
        createDefaultDevice();
        
        // 延迟一下后强制连接
        if (mSurfaceSingle != null) {
            mSurfaceSingle.postDelayed(new Runnable() {
                @Override
                public void run() {
                    android.util.Log.d("FragPreview", "开始强制连接");
                    autoConnectFirstDevice();
                }
            }, 2000);
        }
    }
    
    // 刷新摄像机
    private void refreshCamera() {
        android.util.Log.d("FragPreview", "手动刷新摄像机连接");
        
        // 停止当前预览
        stopSingleCameraPreview();
        
        // 重置连接状态
        mIsAutoConnecting = false;
        mAutoConnectedDevice = null;
        
        // 更新状态显示
        updateConnectionStatus("正在重新连接...", false);
        
        // 延迟一下后重新连接
        if (mSurfaceSingle != null) {
            mSurfaceSingle.postDelayed(new Runnable() {
                @Override
                public void run() {
                    // 重新加载设备并连接
                    loadDevicesAndStartPreview();
                }
            }, 1000);
        }
    }
    
    // 切换全屏模式
    private void toggleFullscreen() {
        if (getActivity() != null) {
            // 隐藏状态栏和导航栏实现全屏
            View decorView = getActivity().getWindow().getDecorView();
            int uiOptions = View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            decorView.setSystemUiVisibility(uiOptions);
            
            android.util.Log.d("FragPreview", "已切换到全屏模式");
        }
    }

    @Override
    public void surfaceCreated(SurfaceHolder holder) {
        holder.setFormat(PixelFormat.OPAQUE);
        android.util.Log.d("FragPreview", "Surface已创建");
        
        // 如果已连接设备，自动开始预览
        if (mAutoConnectedDevice != null && mAutoConnectedDevice.m_struDevState.m_iLogState == 1) {
            android.util.Log.d("FragPreview", "Surface创建后自动开始预览");
            startSingleCameraPreview();
        } else if (mAutoConnectedDevice != null) {
            android.util.Log.d("FragPreview", "Surface已创建，但设备未登录，等待登录完成");
        } else {
            android.util.Log.d("FragPreview", "Surface已创建，但设备未连接");
        }
    }

    @Override
    public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
        android.util.Log.d("FragPreview", "Surface尺寸改变: " + width + "x" + height);
        
        // 如果已在预览，重启预览以适应新尺寸
        if (mPreviewHandle != -1 && mAutoConnectedDevice != null) {
            android.util.Log.d("FragPreview", "重启预览以适应新尺寸");
            stopSingleCameraPreview();
            startSingleCameraPreview();
        }
    }

    @Override
    public void surfaceDestroyed(SurfaceHolder holder) {
        android.util.Log.d("FragPreview", "Surface已销毁");
        stopSingleCameraPreview();
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
    public void onDestroyView() {
        super.onDestroyView();
        // 停止单台摄像机预览
        stopSingleCameraPreview();
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
