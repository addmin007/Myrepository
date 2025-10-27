package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.Model.DBDevice;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MainActivity;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;

public class AddDevActivity extends MyActivityBase {
    String m_szDevName = "10.21.84.166";
    String m_szIp = "10.21.84.166";
    String m_szPort = "8000";
    String m_szUserName = "admin";
    String m_szPassWorld = "hik12345";

    EditText m_etDevName;
    EditText m_etIp;
    EditText m_etPort;
    EditText m_etzUserName;
    EditText m_etPassWorld;
    Button m_btnAdd;
    Button m_btnCancel;

    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_dev);
        m_etDevName = findViewById(R.id.edit_text_name);
        m_etIp = findViewById(R.id.edit_text_ip);
        m_etPort = findViewById(R.id.edit_text_port);
        m_etzUserName = findViewById(R.id.edit_text_username);
        m_etPassWorld = findViewById(R.id.edit_text_password);
        m_etDevName.setText(m_szDevName);
        m_etIp.setText(m_szIp);
        m_etPort.setText(m_szPort);
        m_etzUserName.setText(m_szUserName);
        m_etPassWorld.setText(m_szPassWorld);

        m_btnAdd = findViewById(R.id.button_add);
        m_btnCancel = findViewById(R.id.button_cancel);
        m_btnAdd.setOnClickListener(new View.OnClickListener(){
            public void onClick(View v) {
                // clicked add button
                DevManageGuider.DeviceItem deviceItem = SDKGuider.g_sdkGuider.m_comDMGuider.new DeviceItem();
                deviceItem.m_szDevName = m_etDevName.getText().toString();
                deviceItem.m_struNetInfo = SDKGuider.g_sdkGuider.m_comDMGuider.new DevNetInfo(
                        m_etIp.getText().toString(),
                        m_etPort.getText().toString(),
                        m_etzUserName.getText().toString(),
                        m_etPassWorld.getText().toString());
                if(deviceItem.m_szDevName.isEmpty())
                {
                    deviceItem.m_szDevName = deviceItem.m_struNetInfo.m_szIp;
                }
                if (SDKGuider.g_sdkGuider.m_comDMGuider.login_v40_jna(deviceItem.m_szDevName, deviceItem.m_struNetInfo)) {
                    Toast.makeText(getApplicationContext(), "add device succ!", Toast.LENGTH_LONG).show();

                    // <20190516>: need flass dev listview.
                    if(DBDevice.getInstance(null)!=null)
                    {
                        DBDevice.getInstance(null).insertDevice(deviceItem);
                    }
                    AddDevActivity.this.finish();
                } else {
                    Toast.makeText(getApplicationContext(), "add device failed with "+ SDKGuider.g_sdkGuider.GetLastError_jni(), Toast.LENGTH_LONG).show();
                }
            }
        });
        m_btnCancel.setOnClickListener(new View.OnClickListener(){
            int i = 0;
            public void onClick(View v) {

                Toast.makeText(getApplicationContext(),"Click Cancel"+(++i)+"times", Toast.LENGTH_LONG).show();
                AddDevActivity.this.finish();
            }
        });
    }
}
