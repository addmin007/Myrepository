package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ContextMenu;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.Model.DBDevice;
import com.hik.netsdk.SimpleDemo.Model.DeviceRecorder;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

import java.util.ArrayList;
import java.util.Timer;
import java.util.TimerTask;



public class DrawerAdapter extends BaseAdapter {
    private Handler handler = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            super.handleMessage(msg);
            flushDeviceList();
        }
    };

    Timer timer = new Timer();
    TimerTask timerTask = new TimerTask() {
        @Override
        public void run() {
            Message message = new Message();
            message.what = 1;
            handler.sendMessage(message);
        }
    };

    public class DrawerMenuItem {
        String m_szDevName ;
        String m_szIP;
        int m_iDevIcon ;
        public DrawerMenuItem(String szDevName, String szIP, int iDevIcon){
            m_szDevName = szDevName;
            m_iDevIcon = iDevIcon;
            m_szIP = szIP;
        }
    }


    ArrayList<DrawerMenuItem> m_dlDevs = new ArrayList<DrawerMenuItem>() ;
    int device_list_offset = 0;

    MainActivity m_mainActivity;
    DeviceRecorder m_recorder;


    public DrawerAdapter(MainActivity mainActivity){
        this.m_mainActivity = mainActivity ;
        timer.schedule(timerTask,0,2000);
        // test list
//        for(int i=0;i<30;i++){
//            m_dlDevs.add(new DrawerMenuItem("carmer"+String.valueOf(i), "10.8.98.80", R.drawable.ic_menu_camera)) ;
//        }
        m_recorder = new DeviceRecorder(mainActivity);
        ArrayList<DevManageGuider.DeviceItem> ldev = new ArrayList<DevManageGuider.DeviceItem>();
        ldev.addAll(m_recorder.readDeviceRecord());
        device_list_offset = ldev.size();
        if(DBDevice.getInstance(null)!=null)
        {
            ldev.addAll(DBDevice.getInstance(null).getAllDevices());
        }
        SDKGuider.g_sdkGuider.m_comDMGuider.setDevList(ldev);
        DrawerAdapter.this.notifyDataSetChanged();
    }

    public int getDeviceListOffset(){
        return device_list_offset;
    }

    public void insertDevice(DrawerMenuItem menuItem){
        m_dlDevs.add(menuItem);
    }

    public void removeDevice(int indx){
        m_dlDevs.remove(indx);
    }

    public void flushDeviceList(){
        DrawerAdapter.this.m_dlDevs.clear();
        for (DevManageGuider.DeviceItem item:
                SDKGuider.g_sdkGuider.m_comDMGuider.getDevList()
                ) {
            m_dlDevs.add(new DrawerMenuItem(item.m_szDevName, item.m_struNetInfo.m_szIp, R.drawable.ic_menu_camera));
        }
        DrawerAdapter.this.notifyDataSetChanged();
    }

    @Override
    public int getCount() {
        return m_dlDevs.size();
    }

    @Override
    public Object getItem(int position) {
        return m_dlDevs.get(position) ;
    }

    @Override
    public long getItemId(int position) {
        return position ;
    }



    class MyOnCreateContextMenuListener implements android.view.View.OnCreateContextMenuListener{
        public void onCreateContextMenu(ContextMenu var1, View var2, android.view.ContextMenu.ContextMenuInfo var3) {
            MenuItem item;
            String szItemText;
            switch (SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()).m_struDevState.m_iLogState){
                case 0:
                    szItemText = "login";
                    break;
                case 1:
                    szItemText = "logout";
                    break;
                case 2:
                    szItemText = "relogin";
                    break;
                default:
                    szItemText = "Unknown";
            }
            item = var1.add(0, 0, 0, szItemText);
            item.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener(){
                public boolean onMenuItemClick(MenuItem var1){
//                    Toast.makeText(m_mainActivity, "Pos" + m_iLastSelectPos, Toast.LENGTH_SHORT).show();
                    switch (SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()).m_struDevState.m_iLogState){
                        case 1:
                            if(SDKGuider.g_sdkGuider.m_comDMGuider.logout_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex())){
                                Toast.makeText(m_mainActivity, "logout succ", Toast.LENGTH_SHORT).show();
                            }else{
                                Toast.makeText(m_mainActivity, "logout failed with " + SDKGuider.g_sdkGuider.GetLastError_jni(), Toast.LENGTH_SHORT).show();
                            }
                            break;
                        case 0:case 2:
                            if(SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna_with_index(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex())){
                                Toast.makeText(m_mainActivity, "login succ", Toast.LENGTH_SHORT).show();
                            }else{
                                Toast.makeText(m_mainActivity, "login failed with " + SDKGuider.g_sdkGuider.GetLastError_jni(), Toast.LENGTH_SHORT).show();
                            }
                            break;
                        default:
                            break;
                    }
                    return true;
                }
            });

//            String szItemTextISAPI;
//            switch (SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()).m_struDevState.m_iLogState){
//                case 0:
//                    szItemTextISAPI = "login_isapi";
//                    break;
//                case 1:
//                    szItemTextISAPI = "logout_isapi";
//                    break;
//                case 2:
//                    szItemTextISAPI = "relogin_isapi";
//                    break;
//                default:
//                    szItemTextISAPI = "Unknown_isapi";
//            }
//            item = var1.add(0, 1, 0, szItemTextISAPI);
//            item.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener(){
//                public boolean onMenuItemClick(MenuItem var1){
////                    Toast.makeText(m_mainActivity, "Pos" + m_iLastSelectPos, Toast.LENGTH_SHORT).show();
//                    switch (SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()).m_struDevState.m_iLogState){
//                        case 1:
//                            if(SDKGuider.g_sdkGuider.m_comDMGuider.logout_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex())){
//                                Toast.makeText(m_mainActivity, "logout succ", Toast.LENGTH_SHORT).show();
//                            }else{
//                                Toast.makeText(m_mainActivity, "logout failed with " + SDKGuider.g_sdkGuider.GetLastError_jni(), Toast.LENGTH_SHORT).show();
//                            }
//                            break;
//                        case 0:case 2:
//                            if(SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna_with_isapi(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex())){
//                                Toast.makeText(m_mainActivity, "login succ", Toast.LENGTH_SHORT).show();
//                            }else{
//                                Toast.makeText(m_mainActivity, "login failed with " + SDKGuider.g_sdkGuider.GetLastError_jni(), Toast.LENGTH_SHORT).show();
//                            }
//                            break;
//                        default:
//                            break;
//                    }
//                    return true;
//                }
//            });

            item = var1.add(0, 1, 0, "delete");
            item.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener(){
                public boolean onMenuItemClick(MenuItem var1){
                    switch (SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()).m_struDevState.m_iLogState){
                        case 1: {
                            if (!SDKGuider.g_sdkGuider.m_comDMGuider.logout_jni(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex())) {
                                return false;
                            }

                        }
                            break;
                        default:
                            break;
                    }
                    if (DBDevice.getInstance(null) != null) {
                        if(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex()-device_list_offset>=0)
                        {
                            DBDevice.getInstance(null).removeDeviceById(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDev().m_szUUID);
                        }
                    }
                    SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().remove(SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex());
                    flushDeviceList();
                    return true;
                }
            });

            item = var1.add(0,2,0,"info");
            item.setOnMenuItemClickListener(new MenuItem.OnMenuItemClickListener(){
                public boolean onMenuItemClick(MenuItem var1){
//                    Toast.makeText(m_mainActivity, "Pos" + m_iLastSelectPos, Toast.LENGTH_SHORT).show();
                    Bundle bundle = new Bundle();
                    bundle.putInt("DevIndex", SDKGuider.g_sdkGuider.m_comDMGuider.getCurrSelectDevIndex());
                    AddDevActivity.instance(m_mainActivity, DevInfoActivity.class, bundle);
                    return true;
                }
            });
        }
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        View view = LayoutInflater.from(m_mainActivity).inflate(R.layout.menudrawer_item, parent, false);
        View listView = m_mainActivity.findViewById(R.id.left_drawer);
        if(view != null){
            ImageView img = view.findViewById(R.id.image);
            TextView camera_name = view.findViewById(R.id.name);
            TextView camera_ip = view.findViewById(R.id.ip);

            camera_name.setText(m_dlDevs.get(position).m_szDevName);
            camera_ip.setText(m_dlDevs.get(position).m_szIP);
            img.setImageDrawable(m_mainActivity.getResources().getDrawable(m_dlDevs.get(position).m_iDevIcon));


            ((ListView)listView).setOnItemClickListener(new AdapterView.OnItemClickListener() {
                @Override
                public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
//                    m_iLastSelectPos = position;
                    SDKGuider.g_sdkGuider.m_comDMGuider.setCurrSelectDevIndex(position);
                }
            });

            ((ListView)listView).setOnItemLongClickListener(new AdapterView.OnItemLongClickListener(){
                @Override
                public boolean onItemLongClick(AdapterView<?> arg0, View arg1,
                                               int arg2, long arg3) {
                    SDKGuider.g_sdkGuider.m_comDMGuider.setCurrSelectDevIndex(arg2);
                    return false;
                }
            });

            listView.setOnCreateContextMenuListener(new MyOnCreateContextMenuListener());
        }
        return view ;
    }
}
