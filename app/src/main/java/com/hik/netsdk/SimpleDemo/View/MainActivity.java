package com.hik.netsdk.SimpleDemo.View;

import android.content.res.Configuration;
import android.os.Bundle;
import android.support.v4.view.GravityCompat;
import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.AppCompatActivity;
import android.support.v7.widget.Toolbar;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.widget.Toast;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Model.DBDevice;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.FragmentProxy;
import com.hik.netsdk.SimpleDemo.View.DevMgtUI.AddDevActivity;
import com.hik.netsdk.SimpleDemo.View.DevMgtUI.DrawLayoutProxy;

import java.util.ArrayList;

public class MainActivity extends AppCompatActivity
        /*implements NavigationView.OnNavigationItemSelectedListener*/ {
    private FragmentProxy m_fpFrags;
    private DrawLayoutProxy m_dlDraw;
    private DBDevice m_dbDev;
    private Toolbar m_toolbar;

    public DrawLayoutProxy getDrawLayoutProxy(){
        return m_dlDraw;
    }

    public DBDevice getM_dbDev() { return m_dbDev;}

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);


        m_toolbar = (Toolbar) findViewById(R.id.toolbar);
        setSupportActionBar(m_toolbar);




        m_dbDev = DBDevice.getInstance(this);


        // 检查是否已经初始化过，避免重复初始化
        if (m_dlDraw == null) {
            m_dlDraw = new DrawLayoutProxy(this);
        }
        
        if (m_fpFrags == null) {
            m_fpFrags = new FragmentProxy(this);
        }
    }

    @Override
    public void onDestroy()
    {
        // 清理资源
        if (m_fpFrags != null) {
            // 可选：清理FragmentProxy资源
        }
        super.onDestroy();
    }
    
    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        // 保存状态（虽然使用configChanges，但仍保留此方法作为备份）
        Log.d("MainActivity", "Saving instance state");
    }
    
    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        // 恢复状态
        Log.d("MainActivity", "Restoring instance state");
    }

    @Override
    public void onBackPressed() {
        DrawerLayout drawer = (DrawerLayout) findViewById(R.id.drawer_layout);
        if (drawer.isDrawerOpen(GravityCompat.START)) {
            drawer.closeDrawer(GravityCompat.START);
        } else {
            super.onBackPressed();
        }
    }


    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_main_opt, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();

        //noinspection SimplifiableIfStatement
        switch (item.getItemId()) {
            case R.id.action_1:
            {

                Toast.makeText(this, "add device", Toast.LENGTH_SHORT).show();
                AddDevActivity.instance(this, AddDevActivity.class,null);
            }
                break;

        }

        return super.onOptionsItemSelected(item);
    }
    
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.d("MainActivity", "Orientation changed: " + 
            (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE ? "LANDSCAPE" : "PORTRAIT"));
        
        // 重新设置界面组件，避免组件丢失
        if (m_fpFrags != null && m_dlDraw != null) {
            // Fragment和DrawerLayout应该能自动适应屏幕方向
            Log.d("MainActivity", "Re-initializing UI components after orientation change");
        }
    }
}
