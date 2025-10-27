package com.hik.netsdk.SimpleDemo.View.BusinessUI;

import android.support.v4.app.Fragment;
import android.support.v4.app.FragmentManager;
import android.support.v4.app.FragmentPagerAdapter;

import java.util.ArrayList;

public class MyFragPagerAdapter extends FragmentPagerAdapter {
    private ArrayList<FragmentItem> m_alFrags;

    public MyFragPagerAdapter(FragmentManager fm, ArrayList<FragmentItem> alFrags) {
        super(fm);
        this.m_alFrags = alFrags;
    }

    @Override
    public CharSequence getPageTitle(int position) {
        return m_alFrags.get(position).m_szTitile;
    }

    @Override
    public Fragment getItem(int position) {
        return m_alFrags.get(position).m_frag;
    }

    @Override
    public int getCount() {
        return m_alFrags.size();
    }
}
