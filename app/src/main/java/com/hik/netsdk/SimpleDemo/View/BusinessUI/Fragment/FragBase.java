package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment;

import android.os.Bundle;
import android.support.annotation.Nullable;
import android.support.v4.app.Fragment;

import com.hik.netsdk.SimpleDemo.Control.SDKGuider;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

public class FragBase extends Fragment {
    protected MainActivity m_mainActivity;

    public void setSDKGuider(MainActivity mainActivity) {
        m_mainActivity = mainActivity;
    }
}
