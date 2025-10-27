package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;

import java.util.ArrayList;

public class AddDevAdapter extends BaseAdapter {
    ArrayList<String> m_alDevinfoList = new ArrayList<String>() ;
    DevInfoActivity m_devInfoActivity;
    private int m_iDevIndex = -1;

    public AddDevAdapter(DevInfoActivity devInfoActivity, int iDevIndex){
        m_devInfoActivity = devInfoActivity;
        m_iDevIndex = iDevIndex;
        initDevInfoList(SDKGuider.g_sdkGuider.m_comDMGuider.getDevList().get(iDevIndex));
    }

    private void initDevInfoList(DevManageGuider.DeviceItem devItem) {
        m_alDevinfoList.add("DevName:" + devItem.m_szDevName);
        m_alDevinfoList.add("IP:" + devItem.m_struNetInfo.m_szIp);
        m_alDevinfoList.add("Port:" + devItem.m_struNetInfo.m_szPort);
        m_alDevinfoList.add("State:"
                + (devItem.m_struDevState.m_iLogState == 1 ? "<on-line>" : "<off-line>")
                + (devItem.m_struDevState.m_iAlarmState == 1 ? "<open-alarm>" : "<close-alarm>")
        );
        if (devItem.m_struDeviceInfoV40_jna != null) {
            try {
                m_alDevinfoList.add("Serial No.:" + new String(devItem.m_struDeviceInfoV40_jna.struDeviceV30.sSerialNumber, "UTF-8"));
            } catch (Exception e) {

            }
        }
    }

    @Override
    public int getCount() {
        return m_alDevinfoList.size();
    }

    @Override
    public Object getItem(int position) {
        return m_alDevinfoList.get(position) ;
    }

    @Override
    public long getItemId(int position) {
        return position ;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        TextView view = new TextView(m_devInfoActivity);
        view.setText((String)getItem(position));
        return view;
    }
}
