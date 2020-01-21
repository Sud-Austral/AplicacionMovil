package com.example.activity;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.util.Log;


public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
    }

    @Override
    protected void onStart() {
        super.onStart();
        Log.i("LOGCAT", "Entra en el metodo log onStart");
    }

    @Override
    protected void onResume() {
        super.onResume();
        Log.i("LOGCAT", "Entra en el metodo log onResume");
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.i("LOGCAT", "Entra en el metodo log onPause");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.i("LOGCAT", "Entra en el metodo log onDestroy");
    }
}
