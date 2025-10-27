package com.hik.netsdk.SimpleDemo.View.BusinessUI;

import android.content.Context;
import android.support.v4.view.ViewPager;
import android.util.AttributeSet;
import android.view.MotionEvent;

/**
 * 禁用滑动的ViewPager
 * 只允许通过点击选项卡来切换页面
 */
public class NoSwipeViewPager extends ViewPager {
    
    private boolean isSwipeEnabled = false;

    public NoSwipeViewPager(Context context) {
        super(context);
    }

    public NoSwipeViewPager(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    /**
     * 设置是否允许滑动
     * @param enabled true=允许滑动，false=禁止滑动
     */
    public void setSwipingEnabled(boolean enabled) {
        this.isSwipeEnabled = enabled;
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        // 如果禁用滑动，则拦截触摸事件
        return isSwipeEnabled && super.onTouchEvent(event);
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        // 如果禁用滑动，则不拦截触摸事件，让事件传递给子View
        return isSwipeEnabled && super.onInterceptTouchEvent(event);
    }

    @Override
    public boolean executeKeyEvent(android.view.KeyEvent event) {
        // 禁用键盘按键导航
        return false;
    }
}

