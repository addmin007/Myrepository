package com.hik.netsdk.SimpleDemo.View;

import android.os.Bundle;
import android.support.v4.view.GravityCompat;
import android.support.v4.widget.DrawerLayout;
import android.support.v7.app.AppCompatActivity;
import android.support.v7.widget.Toolbar;
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


        m_dlDraw = new DrawLayoutProxy(this);


        m_fpFrags = new FragmentProxy(this);


    }

    @Override
    public void onDestroy()
    {
        super.onDestroy();
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
}
