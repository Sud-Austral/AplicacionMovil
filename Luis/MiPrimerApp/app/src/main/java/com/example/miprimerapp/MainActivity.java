package com.example.miprimerapp;

import androidx.appcompat.app.AppCompatActivity;

import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity {

    private EditText et1;
    private EditText et2;
    private TextView tv1;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        //Toast.makeText(this, "OnCreate", Toast.LENGTH_SHORT).show();

        et1 = (EditText)findViewById(R.id.txt_num1);
        et1 = (EditText)findViewById(R.id.txt_num2);
        tv1 = (TextView)findViewById(R.id.txt_resultado);

        // La actividad está a creada.
        /*
        int matematicas = 5;
        int quimica = 5;
        int fisica = 5;

        int promedio = (matematicas + quimica + fisica) / 3;


        if(promedio >= 6){
            Toast.makeText(this, "Aprobado", Toast.LENGTH_SHORT).show();
        }else if(promedio <= 5){
            //Toast.makeText(this, "Reprobado", Toast.LENGTH_SHORT).show();
            Toast.makeText(this, "Reprobado", Toast.LENGTH_LONG).show();
        }
        */

    }

    //Este método realiza la suma
    public void Sumar(View view){
        String valor1 = et1.getText().toString();
        String valor2 = et1.getText().toString();

        int num1 = Integer.parseInt(valor1);
        int num2 = Integer.parseInt(valor2);

        int suma = num1 + num2;

        String result = String.valueOf(suma);
        tv1.setText(result);
    }
    @Override
    protected void onStart() {
        super.onStart();
        Toast.makeText(this, "OnStart", Toast.LENGTH_SHORT).show();
        // La actividad está a punto de hacerse visible.
    }
    @Override
    protected void onResume() {
        super.onResume();
        Toast.makeText(this, "OnResume", Toast.LENGTH_SHORT).show();
        // La actividad se ha vuelto visible (ahora se "reanuda").
    }
    @Override
    protected void onPause() {
        super.onPause();
        Toast.makeText(this, "OnPause", Toast.LENGTH_SHORT).show();
        // Enfocarse en otra actividad  (esta actividad está a punto de ser "detenida").
    }
    @Override
    protected void onStop() {
        super.onStop();
        Toast.makeText(this, "OnStop", Toast.LENGTH_SHORT).show();
        // La actividad ya no es visible (ahora está "detenida")
    }
    @Override
    protected void onDestroy() {
        super.onDestroy();
        Toast.makeText(this, "OnDestroy", Toast.LENGTH_SHORT).show();
        // La actividad está a punto de ser destruida.
    }
}
