package com.hik.netsdk.SimpleDemo.View.BusinessUI.Fragment;

import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.annotation.Nullable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.hik.netsdk.SimpleDemo.R;
import com.hik.netsdk.SimpleDemo.View.MainActivity;

public class FragTest1 extends FragBase {
    public static final String ARGS_PAGE = "args_page";
    private TextView textView;
    private int mPage;

    public static FragTest1 newInstance(MainActivity mainActivity, Bundle args) {
        FragTest1 fragment = new FragTest1();
        fragment.setSDKGuider(mainActivity);
        if(args!=null)
        {
            fragment.setArguments(args);
        }
        return fragment;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mPage = 1;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View rootView = inflater.inflate(R.layout.frag_test, container, false);
        textView = rootView.findViewById(R.id.textView2);
        textView.setText("第"+mPage+"页");
        return rootView;
    }
}
