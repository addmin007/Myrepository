package com.hik.netsdk.SimpleDemo.View.BusinessUI;

import com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment.FragBase;

public class FragmentItem {
    public FragBase m_frag;
    public String m_szTitile;

    public FragmentItem(FragBase frag, String szTitile) {
        m_frag = frag;
        m_szTitile = szTitile;
    }
}