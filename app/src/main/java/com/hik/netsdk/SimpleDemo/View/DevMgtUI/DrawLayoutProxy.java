package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.ActionBarDrawerToggle;
import android.widget.ListView;

import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

public class DrawLayoutProxy {
    private MainActivity m_mainActivity;
    private DrawerAdapter m_daMenu;
    private ListView m_lvMenu;
    private DrawerLayout m_dlMenu;

    public DrawLayoutProxy(MainActivity mainActivity) {
        m_mainActivity = mainActivity;
        m_dlMenu = (DrawerLayout)m_mainActivity.findViewById(R.id.drawer_layout);

        ActionBarDrawerToggle mDrawerToggle;
        m_lvMenu = (ListView)m_mainActivity.findViewById(R.id.left_drawer);
        m_daMenu = new DrawerAdapter(mainActivity);
        m_lvMenu.setAdapter(m_daMenu);
        m_lvMenu.setOnItemClickListener(new DrawerItemClickListener(mainActivity));


        mDrawerToggle = new DrawerMenuToggle(m_mainActivity, m_dlMenu,
                (android.support.v7.widget.Toolbar) m_mainActivity.findViewById(R.id.toolbar),
                R.string.navigation_drawer_open, R.string.navigation_drawer_close);
        m_dlMenu.setDrawerListener(mDrawerToggle);
    }

    public DrawerAdapter getDrawerAdapter(){
        return m_daMenu;
    }
}
