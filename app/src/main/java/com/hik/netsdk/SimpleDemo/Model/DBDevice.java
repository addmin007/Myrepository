package com.hik.netsdk.SimpleDemo.Model;

import java.lang.String;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase.CursorFactory;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;

import com.hik.netsdk.SimpleDemo.Control.DevManageGuider;
import com.hik.netsdk.SimpleDemo.Control.SDKGuider;

import java.util.ArrayList;

public class DBDevice {
    private class DBHelper extends SQLiteOpenHelper {
        /**
         * @param context 上下文环境（例如，一个 Activity）
         * @param name    数据库名字
         * @param factory 一个可选的游标工厂（通常是 Null）
         * @param version 数据库模型版本的整数
         *                <p>
         *                会调用父类 SQLiteOpenHelper的构造函数
         */
        public DBHelper(Context context, String name, CursorFactory factory, int version) {
            super(context, name, factory, version);
        }

        /**
         * 在数据库第一次创建的时候会调用这个方法
         * <p>
         * 根据需要对传入的SQLiteDatabase 对象填充表和初始化数据。
         */
        @Override
        public void onCreate(SQLiteDatabase db) {
        }

        /**
         * 当数据库需要修改的时候（两个数据库版本不同），Android系统会主动的调用这个方法。
         * 一般我们在这个方法里边删除数据库表，并建立新的数据库表.
         */
        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            //三个参数，一个 SQLiteDatabase 对象，一个旧的版本号和一个新的版本号

        }

        @Override
        public void onOpen(SQLiteDatabase db) {
            // 每次成功打开数据库后首先被执行
            super.onOpen(db);
        }
    }

    private DBHelper m_dbHelper;
    private SQLiteDatabase m_db;

    private Context m_contex;

    private String db_name = "device";
    private String table_name = "device_list";

    static DBDevice g_dbDevice;

    static public DBDevice getInstance(Context ct) {
        if (g_dbDevice == null) {
            g_dbDevice = new DBDevice(ct);
        }
        return g_dbDevice;
    }

    private DBDevice(Context ct) {
        m_contex = ct;
        m_dbHelper = new DBHelper(ct, db_name, null, 1);
        m_db = m_dbHelper.getWritableDatabase();
        Cursor c = m_db.rawQuery("SELECT * FROM sqlite_master WHERE type='table' and name=?", new String[]{table_name});
        if (!c.moveToFirst()) {
            m_db.execSQL("CREATE TABLE " + table_name + "(id TEXT PRIMARY KEY, devname TEXT, ip TEXT, port TEXT, username TEXT, password TEXT);");
        }
    }

    private SQLiteDatabase open() {
        if (m_db.isOpen()) {
            return m_db;
        }
        if (m_dbHelper == null) {
            m_dbHelper = new DBHelper(m_contex, db_name, null, 1);
        }
        m_db = m_dbHelper.getWritableDatabase();
        return m_db;
    }

    private void close() {
        m_db.close();
    }

    public boolean insertDevice(DevManageGuider.DeviceItem deviceItem) {
        SQLiteDatabase db = open();
        if (db == null || !deviceItem.m_struNetInfo.checkNetInfo()) {
            return false;
        }
        ContentValues cv = new ContentValues();
        // 开始组装第一条数据
        cv.put("id", deviceItem.m_szUUID);
        cv.put("devname", deviceItem.m_szDevName);
        cv.put("ip", deviceItem.m_struNetInfo.m_szIp);
        cv.put("port", deviceItem.m_struNetInfo.m_szPort);
        cv.put("username", deviceItem.m_struNetInfo.m_szUserName);
        cv.put("password", deviceItem.m_struNetInfo.m_szPassword);
        db.insert("device_list", null, cv); // 插入一条数据
        close();
        return true;
    }

    public ArrayList<DevManageGuider.DeviceItem> getAllDevices() {
        SQLiteDatabase db = open();
        if(db == null)
        {
            return null;
        }
        Cursor cv = db.rawQuery("select * from device_list", null);
        ArrayList<DevManageGuider.DeviceItem> alDev = new ArrayList<DevManageGuider.DeviceItem>();
        if (cv.moveToFirst()) {
            do {
                String id = cv.getString(cv.getColumnIndex("id"));
                DevManageGuider.DeviceItem devItem = SDKGuider.g_sdkGuider.m_comDMGuider.new DeviceItem(id);
                String devname = cv.getString(cv.getColumnIndex("devname"));
                Log.i("[ASDemo]", id + "," + devname);
                String ip = cv.getString(cv.getColumnIndex("ip"));
                String port = cv.getString(cv.getColumnIndex("port"));
                String username = cv.getString(cv.getColumnIndex("username"));
                String password = cv.getString(cv.getColumnIndex("password"));
                
                // 处理设备名称为null或空的情况
                if (devname == null || devname.trim().isEmpty()) {
                    devname = "设备_" + ip; // 使用IP作为默认设备名称
                }
                devItem.m_szDevName = devname;
                devItem.m_struNetInfo = SDKGuider.g_sdkGuider.m_comDMGuider.new DevNetInfo(ip, port, username, password);
                alDev.add(devItem);
            } while (cv.moveToNext());
        }
        close();
        return alDev;
    }

    public DevManageGuider.DeviceItem getDeviceById(String id) {
        SQLiteDatabase db = open();
        if(db == null)
        {
            return null;
        }
        Cursor c = db.rawQuery("select * from device_list where id=?", new String[]{id});
        if (c.moveToFirst()) { //判断游标是否为空
            DevManageGuider.DeviceItem devItem = SDKGuider.g_sdkGuider.m_comDMGuider.new DeviceItem();
            String devname = c.getString(c.getColumnIndex("devname"));
            String ip = c.getString(c.getColumnIndex("ip"));
            String port = c.getString(c.getColumnIndex("port"));
            String username = c.getString(c.getColumnIndex("username"));
            String password = c.getString(c.getColumnIndex("password"));
            
            // 处理设备名称为null或空的情况
            if (devname == null || devname.trim().isEmpty()) {
                devname = "设备_" + ip; // 使用IP作为默认设备名称
            }
            devItem.m_szDevName = devname;
            devItem.m_struNetInfo = SDKGuider.g_sdkGuider.m_comDMGuider.new DevNetInfo(ip, port, username, password);
            close();
            return devItem;
        }
        close();
        return null;
    }

    public boolean updateDeviceById(String id, DevManageGuider.DeviceItem devItem) {
        SQLiteDatabase db = open();
        if(db == null)
        {
            return false;
        }
        ContentValues cv = new ContentValues();
        cv.put("devname", devItem.m_szDevName);
        cv.put("ip", devItem.m_struNetInfo.m_szIp);//添加要更改的字段及内容
        cv.put("port", devItem.m_struNetInfo.m_szPort);//添加要更改的字段及内容
        cv.put("username", devItem.m_struNetInfo.m_szUserName);//添加要更改的字段及内容
        cv.put("password", devItem.m_struNetInfo.m_szPassword);//添加要更改的字段及内容
        String whereClause = "id=?";//修改条件
        String[] whereArgs = {id};//修改条件的参数
        db.update(table_name, cv, whereClause, whereArgs);//执行修改
        close();
        return true;
    }

    public boolean removeDeviceById(String id) {
        SQLiteDatabase db = open();
        if(db == null)
        {
            return false;
        }
        int ret = db.delete(table_name, "id=?", new String[]{id});//执行删除
        close();
        // 检查删除是否成功，ret > 0 表示有记录被删除
        return ret > 0;
    }
}