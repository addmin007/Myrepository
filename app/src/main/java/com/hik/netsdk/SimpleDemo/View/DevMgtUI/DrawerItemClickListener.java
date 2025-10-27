package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.view.View;
import android.widget.AdapterView;
import android.widget.ListView;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.View.MainActivity;


public class DrawerItemClickListener implements ListView.OnItemClickListener {
    private MainActivity m_mainActivity;

    public DrawerItemClickListener(MainActivity mainActivity){
        m_mainActivity = mainActivity;
    }

    @Override
    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
        selectItem(position);
    }

    public void selectItem(int position){
        Toast.makeText(m_mainActivity, "menu item"+String.valueOf(position), Toast.LENGTH_SHORT).show();
    }

    public void setTitle(String title){

        m_mainActivity.getActionBar().setTitle(title);
    }
}
