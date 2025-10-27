package com.hik.netsdk.SimpleDemo.View.DevMgtUI;

import android.app.Activity;
import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.ActionBarDrawerToggle;
import android.support.v7.widget.Toolbar;
import android.view.View;


public class DrawerMenuToggle extends ActionBarDrawerToggle {



    public DrawerMenuToggle(Activity activity, DrawerLayout drawerLayout,
                            Toolbar drawerImageRes, int openDrawerContentDescRes,
                            int closeDrawerContentDescRes) {

        super(activity, drawerLayout, drawerImageRes, openDrawerContentDescRes,closeDrawerContentDescRes);

    }


    public void onDrawerClosed(View view) {
        super.onDrawerClosed(view);

    }

    /** 当侧滑菜单完全打开时，这个方法被回调 */
    public void onDrawerOpened(View drawerView) {
        super.onDrawerOpened(drawerView);

    }
};
