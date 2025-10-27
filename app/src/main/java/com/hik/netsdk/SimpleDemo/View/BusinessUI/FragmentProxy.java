package com.hik.netsdk.SimpleDemo.View.BusinessUI;

import android.content.res.XmlResourceParser;
import android.os.Bundle;
import android.support.design.widget.TabLayout;
import android.support.v4.view.ViewPager;
import android.util.Log;

import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserException;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

public class FragmentProxy {
    private TabLayout m_tlFuncTabs;
    private ViewPager m_vpFuncPage;
    private ArrayList<FragmentItem> m_alFrags;
    private MainActivity m_mainAct;
    List<FragConfig> m_lConfig;

    public class FragConfig {
        public String m_className = null;
        public String m_titile = null;
        public Object m_args = null;
    }

    public class FragConfigParser {
        /**
         * @return
         * @throws Exception
         */
        public List<FragConfig> getConf() throws Exception {
            List<FragConfig> lConfig = new ArrayList<FragConfig>();
            XmlResourceParser parser;
            try {
                parser = m_mainAct.getResources().getXml(R.xml.fragconfig);
                //循环直到文档结束
                while (parser.next() != XmlPullParser.END_DOCUMENT) {
                    if ("fragitem".equals(parser.getName())) {
                        int i = parser.getAttributeCount();
                        FragConfig conf = new FragConfig();
                        while(i > 0){
                            if(parser.getAttributeName(i-1).equals("className")){
                                conf.m_className = parser.getAttributeValue(i-1);
                            }
                            else if(parser.getAttributeName(i-1).equals("titile")){
                                conf.m_titile = parser.getAttributeValue(i-1);
                            }
                            i--;
                        }
                        if(conf.m_className != null && conf.m_titile != null){
                            lConfig.add(conf);
                        }
                    }
                }
            } catch (XmlPullParserException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            }
            return lConfig;
        }
    }

    public FragmentProxy(MainActivity mainAct) {
        m_mainAct = mainAct;
        m_alFrags = new ArrayList<>();
        initFragmentWithTitile();
        initView();
    }

    private void initView() {
        m_tlFuncTabs = m_mainAct.findViewById(R.id.fag_tabs);
        m_vpFuncPage = m_mainAct.findViewById(R.id.fag_pager);

        m_vpFuncPage.setAdapter(new MyFragPagerAdapter(m_mainAct.getSupportFragmentManager(), m_alFrags));
        m_tlFuncTabs.setupWithViewPager(m_vpFuncPage);

        m_vpFuncPage.setOffscreenPageLimit(m_alFrags.size());
        m_vpFuncPage.addOnPageChangeListener(new TabLayout.TabLayoutOnPageChangeListener(m_tlFuncTabs));
        m_tlFuncTabs.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                Log.d("TAG", "onTabSelected: ");
                m_vpFuncPage.setCurrentItem(m_tlFuncTabs.getSelectedTabPosition(), true);
            }

            @Override
            public void onTabUnselected(TabLayout.Tab tab) {
                Log.d("TAG", "onTabUnselected: ");
            }

            @Override
            public void onTabReselected(TabLayout.Tab tab) {
                Log.d("TAG", "onTabReselected: ");
            }
        });

    }

    private void initFragConif(){
        FragConfigParser fcParser = new FragConfigParser();
        try {
            m_lConfig = fcParser.getConf();
        }
        catch (Exception e){
            e.printStackTrace();
        }
    }

    /**
     * @fn void initFragmentWithTitile
     * @brief 用户的Fragment构造，只改需要改成根据配置文件加载
     */
    private void initFragmentWithTitile() {
        initFragConif();
        for(int i=0;i<m_lConfig.size();++i){
            try{
                Class<?> fragClass = Class.forName(m_lConfig.get(i).m_className);
                Method instance = fragClass.getMethod("newInstance",MainActivity.class, Bundle.class);
                m_alFrags.add(new FragmentItem((FragBase) instance.invoke(null,m_mainAct, null),
                        m_lConfig.get(i).m_titile));
            }
            catch (Exception e){
                e.printStackTrace();
            }
        }
//
//
//        m_alFrags.add(new FragmentItem(FragTest1.newInstance(m_mainAct, null), "card1"));
//        m_alFrags.add(new FragmentItem(FragTest2.newInstance(m_mainAct, null), "card2"));
//        m_alFrags.add(new FragmentItem(FragTest1.newInstance(m_mainAct, null), "card3"));
//        m_alFrags.add(new FragmentItem(FragTest2.newInstance(m_mainAct, null), "card4"));
//        m_alFrags.add(new FragmentItem(FragTest1.newInstance(m_mainAct, null), "card5"));
//        m_alFrags.add(new FragmentItem(FragTest2.newInstance(m_mainAct, null), "card6"));
    }
}
