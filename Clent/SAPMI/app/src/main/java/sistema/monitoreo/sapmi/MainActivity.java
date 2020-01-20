package sistema.monitoreo.sapmi;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;

public class MainActivity extends AppCompatActivity {


    Button btnSitios,btnUbicacion,btnTipos;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        btnSitios = (Button) findViewById(R.id.btn_Sitios);
        btnUbicacion = (Button)findViewById(R.id.btn_Ubicacion);

        btnSitios.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent= new Intent(getApplicationContext(),MapsActivity1.class);
                startActivity(intent);
            }
        });

        btnTipos = (Button)findViewById(R.id.btn_Tipos);
        btnTipos.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intentBrowser = new Intent(Intent.ACTION_VIEW,Uri.parse("https://anin.users.earthengine.app/view/appince"));
                startActivity(intentBrowser);
            }
        });

    }

    public void miUbicacion(View view) {
        Intent intent= new Intent(getApplicationContext(),MapsActivity_miUbicacion.class);
        startActivity(intent);
    }

}
