package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.ListView;

import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MyActivityBase;

public class DevInfoActivity extends MyActivityBase {

    private int m_iDevIndex = -1;
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dev_info);
        Intent intent = this.getIntent();
        m_iDevIndex = intent.getExtras().getInt("DevIndex");
        ListView lvMenu = findViewById(R.id.listview_devinfo);
        AddDevAdapter daMenu = new AddDevAdapter(this, m_iDevIndex);
        lvMenu.setAdapter(daMenu);
    }
}
