//*******************************************ÁREA DE ESTUDIO***********************************************//
// Area de estudio
var Limite_pais = GT;
var Area_Estudio = GT;

//var Area_Estudio = Limite_pais.filterMetadata('DEPTO_1', 'equals', 'Petén');
//

//Filtros por fecha
var Fecha_inicial=  "2019-01-01";
var Fecha_final=    "2019-12-31";

//*******************************************COLECCIÓN DE DATOS********************************************//
//Agregar la collección de imagenes con puntos de altos de temperatura
var FIRMS_colection =  ee.ImageCollection('FIRMS');//focos de incendios
var modisdata =        ee.ImageCollection ('MODIS/006/MCD64A1');//cicatrices de incendios
var fire =              ee.ImageCollection('MODIS/006/MCD64A1');//cicatrices de incendios/mensual
var Modis_Terra1d =    ee.ImageCollection('MODIS/006/MOD09GA');    //Indice de área quemada
var NBRT_L8 =          ee.ImageCollection ('LANDSAT/LC8_L1T_ANNUAL_NBRT');//Indice de combustión
var NBRT_L7 =          ee.ImageCollection ("LANDSAT/LE7_L1T_ANNUAL_NBRT");
var NBRT_L5 =          ee.ImageCollection ('LANDSAT/LT5_L1T_ANNUAL_NBRT');
var L8 =               ee.ImageCollection ('LANDSAT/LC08/C01/T1_RT_TOA');
var L7 =               ee.ImageCollection ('LANDSAT/LE07/C01/T1_RT_TOA');
var L5 =               ee.ImageCollection ('LANDSAT/LT05/C01/T1_TOA');

//*************************************PROCESAMIENTO DE COLECCION FIRMS************************************//
//var auxiliar = FIRMS_colection;
//FILTROS DE LA COLLECCIÓN DE IMAGENES 
var FIRMS =FIRMS_colection
  .select(['T21'])
  .filterDate(Fecha_inicial,Fecha_final)
  .filterBounds(Area_Estudio);

// Reducir alertas de fuejo de  MODIS  a una imagen binaria única
var FIRMScount  = ee.Image(FIRMS.count()).clip(Area_Estudio);
var FIRMSbinary = FIRMScount.eq(FIRMScount).rename('FIRMS_binary_alert');


// MODIS fuegos en vector
var project_crs   = ee.Image(FIRMS.first()).projection().crs();
var scale = ee.Image(FIRMS.first()).projection().nominalScale(); 
var FIRMSpoint = FIRMSbinary.reduceToVectors({
  geometry: Area_Estudio,
  eightConnected:true,
  labelProperty:'modis_fire',
  maxPixels:2e8,
  crs:project_crs,
  scale:scale,
  geometryType: 'centroid',
});

//*************************************PROCESAMIENTO DE COLECCION MODIS************************************//
//En esta sección se calculan las cicatrices de incendios filtrando por tipo de incendios, por tipo de incertidumbre
// y por rango de fecha
var modisdata2 = ee.ImageCollection('MODIS/006/MCD64A1')
                   .filterDate(Fecha_inicial,Fecha_final)
                   .select('BurnDate','QA');
//Función para calcular cicatrices de incendios de forma anual
var allFires = (function(img) {
  var burndate = img.select('BurnDate');
  var Incertidumbre= img.select("Uncertainty");
  var goodQA = img.select("QA").lte(4); // keep QA values 1-4 (5 is detection over agricultural areas)
  var vali_incertid=Incertidumbre.gt(60).and(burndate.lt(100));
  var validDates = burndate.gt(0).and(burndate.lt(367)); // outside of this range is snow/water/error
  return img.updateMask(validDates.and(goodQA)).gt(0);
});

//map function across MODIS data
var modisFires = modisdata2.map(allFires);
var allBurned = modisFires.reduce(ee.Reducer.anyNonZero());

var allBurned_clip= allBurned.clip(Area_Estudio);

//*************************************PROCESAMIENTO DE COLECCION MODIS 2************************************//
//En esta sección se calculan los incendios de forma mensual
var fire = ee.ImageCollection('MODIS/006/MCD64A1').select('BurnDate')
function compute(begin, end) {
  var t = begin.millis()
  return fire.filterDate(begin, end).max().rename('fire').clip(Area_Estudio)
    //.addBands(evi.filterDate(begin, end).mean().divide(1000).rename('evi'))
   // .addBands(precipitation.filterDate(begin, end).mean().rename('precipitation'))
    .set('system:time_start', t)
}
var years = ee.List.sequence(2018, 2018)//Dentro del panel de Botones debe haber una opción para seleccionar el año de intéres
var months = ee.List.sequence(1, 12)

var results = years.map(function(year) {
  return months.map(function(month) {
    var begin = ee.Date.fromYMD(year, month, 1)
    var end = begin.advance(1, 'month')
    
    return compute(begin, end)
  })
})

results = ee.ImageCollection(results.flatten())

var multiband = ee.Image().select()
var multiband = ee.Image(results.iterate(function(image, result) {
   return ee.Image(result).addBands(image)
}, multiband)) 

var mean_results = results.mean();
var mb = multiband.select(  ['fire',  'fire_1',   'fire_2', 'fire_3', 'fire_4', 'fire_5', 'fire_6', 'fire_7', 'fire_8',    'fire_9',   'fire_10',  'fire_11'],
                            ['enero', 'febrero',  'marzo',  'abril',  'mayo',   'junio',  'julio',  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']);
print(mb)

//*************************************PROCESAMIENTO DE COLECCION LANDSAT************************************//
var collecion_NBRT = L8
.filterBounds(Area_Estudio)
.filterDate(Fecha_inicial,Fecha_final);

//Calculo de media y corte
var nbrt_clip= collecion_NBRT.mean().clip(Area_Estudio)

// calculo nbrt
var nbrt = nbrt_clip.expression(
  '(NIR - 0.0001 * SWIR * Temp) / (NIR + 0.0001 * SWIR * Temp)', {
    'NIR': nbrt_clip.select('B5'),
    'SWIR': nbrt_clip.select('B7'),
    'Temp': nbrt_clip.select('B11')
}).rename('NBRT_2');

//**********************************************PROCESAMIENTO BAI*******************************************//
//BAI
var BAI_coleccion = Modis_Terra1d
         .filterDate(Fecha_inicial,Fecha_final)
         .filterBounds(Area_Estudio)
         ;
         
var BAI_clip= BAI_coleccion.mean().clip(Area_Estudio)


//Funcion BAI
var BAI = BAI_clip.expression(
   '(1.0 / ((0.1 - RED)**2 + (0.06 - NIR)**2))*10000000', {
     'NIR': BAI_clip.select('sur_refl_b02'),
     'RED': BAI_clip.select('sur_refl_b01')})
  .rename('BAI')
         


//*******************************************VISUALIZACIÓN DE CAPAS***************************************//
//Centrar Mapa
Map.centerObject(Area_Estudio);
//Parametros de visualización
var viz = {opacity: 0.7, palette:"545454"};
var vizParameters = {bands: ['BurnDate'],min: 0, max: 366, palette: ['red', 'green']};
//Visualización
Map.addLayer(Area_Estudio,viz,'Area Estudio');
//Map.addLayer(FIRMScount, {palette: ['red'] }, 'Focos_Raster', false);
Map.addLayer(FIRMSpoint, {color:    'red'  }, 'Alertas de Calor FIRMS');
//Map.addLayer(mean_results, vizParameters, 'Cicatrices_Historicas',false);
Map.addLayer(allBurned_clip.select(0), {palette:"orange"},'Cicatrices');
Map.addLayer(nbrt,  {min: 1, max: 0.95,palette: ['green', 'blue', 'yellow', 'red' ]},'NBRT',false);
Map.addLayer(BAI,      {min: 0,   max: 1,  palette: ['Red','Yellow','Green']},'BAI', false);

//*******************************************DESCARGA DE DATOS***************************************//
//Descargar Cicatrices de incendios historicos
Export.image.toDrive({
  image: mb, 
  description: "Cicatrices_Mensuales", 
  scale: 500, 
  maxPixels:1e13,
  //crs: "EPSG:4326"
})
//Descargar Cicatrices de incendios
Export.image.toDrive({
  image: allBurned_clip, 
  description: "Cicatrices",
  scale: 500, 
  maxPixels:1e13,
  //crs: "EPSG:4326"
})

//Descarga capa NBRT
Export.image.toDrive({
  image:nbrt,
  description:"NBRT",
  scale: 30,
  region: Area_Estudio,
 // folder: "Hansen",
  maxPixels:5e9
  });

//Descarga capa BAI
Export.image.toDrive({
  image:nbrt,
  description:"BAI",
  scale: 30,
  region: Area_Estudio,
 // folder: "Hansen",
  maxPixels:5e9
  });
  
//Descarga Alerta de calor FIRMS 
  Export.table.toDrive({
  collection:FIRMSpoint,
  description:'Alertas de Calor FIRMS',
  //folder:'',
  //fileNamePrefix:'',
  fileFormat:'SHP' 
});


//***********************************************************************************************
//                                     Funciones
// A continuacion se definen las funciones que se utilizaran para añadir funcionalidad a los
//widget
//***********************************************************************************************
//                Incendio por año
//Se define la funcion incendio
function Incendio(){
  //Limpiar el mapa de datos anteriores
  Map.clear();
//***********************************************************************************************
//Codigo de Fabio Inicio
  //var FIRMS_colection =  ee.ImageCollection('FIRMS');//focos de incendios
  //print(FIRMS_colection);
  print('Fecha inicial: ' + Fecha_inicial );
  print('Fecha final: ' + Fecha_final );
  FIRMS =FIRMS_colection
  .select(['T21'])
  .filterDate(Fecha_inicial,Fecha_final)
  .filterBounds(Area_Estudio);
  //print(FIRMS);
  var FIRMScount  = ee.Image(FIRMS.count()).clip(Area_Estudio); 
  var FIRMSbinary = FIRMScount.eq(FIRMScount).rename('FIRMS_binary_alert');
  var FIRMSpoint = FIRMSbinary.reduceToVectors({
  geometry: Area_Estudio,
  eightConnected:true,
  labelProperty:'modis_fire',
  maxPixels:2e8,
  crs:project_crs,
  scale:scale,
  geometryType: 'centroid',
  });
  //Codigo de Fabio Final
//***********************************************************************************************  
  //Muestro en el mapa la informacion seleccionada.
  Map.addLayer(FIRMSpoint, {color:    'red'  }, 'Alertas de Calor FIRMS');
}
//***********************************************************************************************
//              Cicatrices
function Cicatriz(){
    //Limpiar el mapa de datos anteriores
  Map.clear();
  //***********************************************************************************************
//Codigo de Fabio Inicio
  var modisdata2 = ee.ImageCollection('MODIS/006/MCD64A1')
                   .filterDate(Fecha_inicial,Fecha_final)
                   .select('BurnDate','QA');
  var modisFires = modisdata2.map(allFires);
  var allBurned = modisFires.reduce(ee.Reducer.anyNonZero());

  var allBurned_clip= allBurned.clip(Area_Estudio);
  //Codigo de Fabio Inicio
  //***********************************************************************************************
  //Muestro en el mapa la informacion seleccionada.
  Map.addLayer(allBurned_clip.select(0), {palette:"orange"},'Cicatrices');
}
//***********************************************************************************************
//              Combustible
function Combustible(){
    //Limpiar el mapa de datos anteriores
  Map.clear();
  //***********************************************************************************************
//Codigo de Fabio Inicio
  var L8 = ee.ImageCollection ('LANDSAT/LC08/C01/T1_RT_TOA');
  var collecion_NBRT = L8
  .filterBounds(Area_Estudio)
  .filterDate(Fecha_inicial,Fecha_final);
  //Calculo de media y corte
  var nbrt_clip= collecion_NBRT.mean().clip(Area_Estudio);
  // calculo nbrt
  var nbrt = nbrt_clip.expression(
    '(NIR - 0.0001 * SWIR * Temp) / (NIR + 0.0001 * SWIR * Temp)', {
      'NIR': nbrt_clip.select('B5'),
      'SWIR': nbrt_clip.select('B7'),
      'Temp': nbrt_clip.select('B11')
  }).rename('NBRT_2');
  //Codigo de Fabio Inicio
  //***********************************************************************************************
  //Muestro en el mapa la informacion seleccionada.
  Map.addLayer(nbrt,  {min: 1, max: 0.95,palette: ['green', 'blue', 'yellow', 'red' ]},'NBRT'); 
  //Mostrar leyenda
  leyendaNBRT();
}
//***********************************************************************************************
//              Quemada
function Quemada(){
    //Limpiar el mapa de datos anteriores
  Map.clear();
  //***********************************************************************************************
//Codigo de Fabio Inicio
  var Modis_Terra1d =    ee.ImageCollection('MODIS/006/MOD09GA');    //Indice de área quemada
  var BAI_coleccion = Modis_Terra1d
         .filterDate(Fecha_inicial,Fecha_final)
         .filterBounds(Area_Estudio)
         ;
         
  var BAI_clip= BAI_coleccion.mean().clip(Area_Estudio);
  var BAI = BAI_clip.expression(
   '(1.0 / ((0.1 - RED)**2 + (0.06 - NIR)**2))*10000000', {
     'NIR': BAI_clip.select('sur_refl_b02'),
     'RED': BAI_clip.select('sur_refl_b01')})
  .rename('BAI');
  //Codigo de Fabio Inicio
  //***********************************************************************************************
  //Muestro en el mapa la informacion seleccionada.
  Map.addLayer(BAI,      {min: 0,   max: 1,  palette: ['Red','Yellow','Green']},'BAI');
  //Mostrar leyenda
  leyendaBAI();
}
//***********************************************************************************************
//              Guardar Cicatriz
//Se definen las funciones para guardar en el Drive las imagenes que se han seleccionado en el
//Drop Down List
function SaveCicatriz(){
  //Descargar Cicatrices de incendios
  Export.image.toDrive({
    image: allBurned_clip, 
    description: "Cicatrices",
    scale: 500, 
    maxPixels:1e13,
    //crs: "EPSG:4326"
  })
}
//***********************************************************************************************
//              Guardar Combustible
function SaveCombustible(){
  //Descarga capa NBRT
  Export.image.toDrive({
    image:nbrt,
    description:"NBRT",
    scale: 30,
    region: Area_Estudio,
   // folder: "Hansen",
    maxPixels:5e9
    });
}
//***********************************************************************************************
//              Guardar Quemada
function SaveQuemada(){  
  //Descarga capa BAI
  Export.image.toDrive({
    image:nbrt,
    description:"BAI",
    scale: 30,
    region: Area_Estudio,
   // folder: "Hansen",
    maxPixels:5e9
    });
}
//***********************************************************************************************
//              Guardar Incendio
function SaveIncendio(){
  //Descarga Alerta de calor FIRMS 
    Export.table.toDrive({
    collection:FIRMSpoint,
    description:'Alertas de Calor FIRMS',
    //folder:'',
    //fileNamePrefix:'',
    fileFormat:'SHP' 
  });
}
//***********************************************************************************************
//              Guardar Incendio
function Actualizar(){
  switch(seleccion){
      //Se muestra los incendios
      case 'Puntos de calor FIRMS': Incendio();
      break;
      //Se muestra las cicatrices
      case 'Cicatrices de incendios MODIS': Cicatriz();
      break;
      //Se muestra el indice de conbustible
      case 'Índice de combustión (NRBT)': Combustible();
      break;
      //Se muestra el area quemada
      case 'Índice de área quemada (BAI)': Quemada();
      break;
    }
}
//***********************************************************************************************
//                                     Definir panel principal
//***********************************************************************************************
var panelPrincipal = ui.Panel({
    widgets: [
        ui.Label({
            value: 'Sistema de Alerta para el Monitoreo del Fuego.',
            style: { fontWeight: 'bold',  fontSize: '30px', 
            margin: '5px 5px', textAlign: 'center', color: '#2660b0', fontFamily: 'Agency FB' }
        }),
    ],
    style: {
        width: '400px',
        padding: '10px',
    }

});
//***********************************************************************************************

//***********************************************************************************************
//                         Slider del año inicial
//***********************************************************************************************
/*
//Deprecated No esta funcionando
var sliderDeDatesInicial = ui.Slider({style: {
  stretch: 'horizontal', 
  margin: '20px 0px 0px 0px',  
  border: '1px solid black',
  padding: '10px'}});
//MARGIN: (TOP, RIGHT,BOTTON, LEFT )
// Definicion de los parametros del slider:
sliderDeDatesInicial.setMax(2018);
sliderDeDatesInicial.setMin(2001);
sliderDeDatesInicial.setStep(1);
sliderDeDatesInicial.onChange(function(value) {
  //Cuando cambia, invoca a la funcion Incendio() y se le entrega como parametro el año seleccionado
  Incendio(value);
});
*/
//***********************************************************************************************
//***********************************************************************************************
//                         Slider del año Final
//***********************************************************************************************
//Deprecated No esta funcionando
/*
var sliderDeDatesFinal = ui.Slider({style: {
  stretch: 'horizontal', 
  margin: '20px 0px 0px 0px',  
  border: '1px solid black',
  padding: '10px'}});
//MARGIN: (TOP, RIGHT,BOTTON, LEFT )
// Definicion de los parametros del slider:
sliderDeDatesFinal.setMax(2018);
sliderDeDatesFinal.setMin(2001);
sliderDeDatesFinal.setStep(1);
sliderDeDatesFinal.onChange(function(value) {
  alert(value);
});
*/
//***********************************************************************************************
//                         Slider del Incertidumbre
//***********************************************************************************************
//Deprecated No esta funcionando
/*
var sliderIncertidumbre = ui.Slider({style: {
  stretch: 'horizontal', 
  margin: '20px 0px 0px 0px',  
  border: '1px solid black',
  padding: '10px'}});
  
//MARGIN: (TOP, RIGHT,BOTTON, LEFT )
// Definicion de los parametros del slider:
sliderIncertidumbre.setMax(100);
sliderIncertidumbre.setMin(30);
sliderIncertidumbre.setStep(1);

sliderIncertidumbre.onChange(function(value) {
  alert(value);
});
*/
//***********************************************************************************************

//***********************************************************************************************
//                     Lista de regiones de Guatemala
// Se asocia la etiqueta que desplegara el ddl con el valor al que corresponde:
var departamentos = {
  'Nivel nacional' : 'Nivel nacional',
      'El Progreso': 'El Progreso',
      'Sacatepéquez':'Sacatepéquez',
      'Chimaltenango':'Chimaltenango',
      'Escuintla':'Escuintla',
      'Santa Rosa': 'Santa Rosa',
      'Guatemala':'Guatemala',
      'Sololá':'Sololá',
      'Totonicapán':'Totonicapán',
      'Quetzaltenango':'Quetzaltenango',
      'Suchitepéquez':'Suchitepéquez',
      'Retalhuleu':'Retalhuleu',
      'San Marcos': 'San Marcos',
      'Huehuetenango':'Huehuetenango',
      'Quiché':'Quiché',
      'Baja Verapaz': 'Baja Verapaz',
      'Alta Verapaz': 'Alta Verapaz',
      'Petén':'Petén',
      'Izabal':'Izabal',
      'Zacapa':'Zacapa',
      'Chiquimula':'Chiquimula',
      'Jalapa':'Jalapa',
      'Jutiapa':'Jutiapa'
};

var dropdownlist_de_filtro = ui.Select({
  items: Object.keys(departamentos),
  onChange: function(key) {
    if(key != 'Nivel nacional')
    {
            Area_Estudio = Limite_pais.filterMetadata('DEPTO_1', 'equals', key);
    }
    else
    {
      Area_Estudio = GT;
    }
    if(!seleccion){
      print('No se actualizara el mapa');
    }
    else{
       Actualizar();
    }
}});
    


//***********************************************************************************************
//                     DropDownList con las Regiones de Guatemala
/* Deprecated
var dropdownlist_de_filtro = ui.Select({
  items: Object.keys(departamentos),
  onChange: function(key) {
    //alert(key);
    //Al cambiar la seleccion, se vuelve a setear el area de estudio de acuerdo a los seleccionado
    //por el usuario.
    Area_Estudio = Area_Estudio = Limite_pais.filterMetadata('DEPTO_1', 'equals',key);
    if(!seleccion){
      print('No se actualizara el mapa');
    }
    else{
       Actualizar();
    }
  }
});
*/
// se carga el primer elemento del dropdownlist:
dropdownlist_de_filtro.setPlaceholder('Nacional/departamento');
//***********************************************************************************************
//***********************************************************************************************
// Fecha inicial
var dateInicio = ui.DateSlider({
    style: {
    stretch: 'horizontal', 
    margin: '0px 0px 10px 0px'},  
    //border: '10px solid black',
    //padding: '1px'},
    //Fecha minima que puede ser seleccionada
    start: '2002-01-01',
    //Fecha maxima que puede ser seleccionada, seteada como el dia de hoy.
    end: Date.now(),
    //Fecha en la que aparece al inicio de la ejecucion 2002-01-01
    value: '2002-01-01',
    //period: 12,
    onChange:  function(value) {
      //Validacion simple que avisa al usuario que la fecha final es menor que la inicial
      validaFechas()
      //Transforma en una fecha tipo DateTime
      var fecha = ee.Date(dateInicio.getValue()[0]);
      //Setea Fecha_inicial en el valor seleccionado.
      Fecha_inicial = fecha; 
    
  } 
  });
//***********************************************************************************************
//  Fecha final
var dateFinal = ui.DateSlider({
    style: {
    stretch: 'horizontal', 
    margin: '0px 10px 10px 15px'},  
    //border: '10px solid black',
    //padding: '1px',
    //Fecha minima que puede ser seleccionada
    start: '2000-12-01',
    //Fecha maxima que puede ser seleccionada, seteada como el dia de hoy.
    end: Date.now(),
    //Fecha en la que aparece al inicio de la ejecucion 2002-01-01
    value: Date.now(),
    //period: 12,
    onChange:  function(value) {
      //Validacion simple que avisa al usuario que la fecha final es menor que la inicial
      validaFechas()
      //Transforma en una fecha tipo DateTime
      var fecha = ee.Date(dateFinal.getValue()[0]);
      //Setea Fecha_final en el valor seleccionado.
      Fecha_final = fecha;
      
  } 
  });
//***********************************************************************************************
//   Validador fechas
//  Validacion simple
function validaFechas(){
  //Si la fecha final es menor que la inicial, envia un mensaje al usuario
  if(dateFinal.getValue()[0] <= dateInicio.getValue()[0]){
    //Solo envia un mensaje
    alert("Si la fecha inicial es mayor que la final habrá conflictos");
    //Setea el valor del dateSlider fecha final a la fecha actual, para impedir un error del usuario
    dateFinal.setValue(Date.now());
  }
}
//***********************************************************************************************
//   Panel con las fechas
var panelFechas = ui.Panel({
        widgets: [dateInicio, dateFinal],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
//***********************************************************************************************
//   DropDownList Variables
//Lista de variables
var variables = {
      'Puntos de calor FIRMS': 1,
      'Cicatrices de incendios MODIS': 2,
      'Índice de combustión (NRBT)': 3,
      'Índice de área quemada (BAI)':4,
};
//Variable donde se guaradara la seleccion del drop down list de variables
var seleccion = null;
var dropdownlist_variables = ui.Select({
  style: {margin: '20px'},
  items: Object.keys(variables),
  onChange: function(key) {
    //alert(key);
    //Setea la fecha inicial desde el dataslider
    Fecha_inicial = ee.Date(dateInicio.getValue()[0]);
    print(Fecha_inicial);
    //Setea la fecha final desde el dataslider
    Fecha_final = ee.Date(dateFinal.getValue()[0]);
    print(Fecha_final);
    //Se guarda la variable seleccionada
    seleccion = key;
    //Dependiendo de la seleccion, se ejecuta un metodo distinto
    //Despliega un mensaje con el mapa a descargar
    alert('El mapa '+ seleccion + ' será descargado en su Drive' );
    //Dependiendo de la seleccion, se ejecutara la descarga correcta
    switch(seleccion){
      //Descarga incendios
      case 'Puntos de calor FIRMS': SaveIncendio();
      break;
      //Descarga cicatrices
      case 'Cicatrices de incendios MODIS': SaveCicatriz();
      break;
      //Descarga indice de combustible
      case 'Índice de combustión (NRBT)': SaveCombustible();
      break;
      //Descarga area quemada
      case 'Índice de área quemada (BAI)': SaveQuemada();
      break;
    } 
  }
});
// se carga el primer elemento del dropdownlist:
dropdownlist_variables.setPlaceholder('Seleccionar capa de interés');
//***********************************************************************************************
//Boton para guardar
var button = ui.Button({
  //Genera un espacio sobre el boton
  style: {margin: '200px 0px 0px 0px'},
  label: 'Descargar Mapa',
  onClick: function() {
    //Despliega un mensaje con el mapa a descargar
    alert('El mapa '+ seleccion + ' será descargado en su Drive' );
    //Dependiendo de la seleccion, se ejecutara la descarga correcta
    switch(seleccion){
      //Descarga incendios
      case 'Puntos de calor FIRMS': SaveIncendio();
      break;
      //Descarga cicatrices
      case 'Cicatrices de incendios MODIS': SaveCicatriz();
      break;
      //Descarga indice de combustible
      case 'Índice de combustión (NRBT)': SaveCombustible();
      break;
      //Descarga area quemada
      case 'Índice de área quemada (BAI)': SaveQuemada();
      break;
    } 
  }
});
//***********************************************************************************************
//Boton para Actualizar
var buttonUpdate = ui.Button({
  //Genera un espacio sobre el boton
  style: {margin: '10px 0px 0px 0px'},
  label: 'Actualizar',
  onClick: function() {
    if(!seleccion){
      alert("Debe seleccionar una variable antes de Actualizar");
    }
    else{
      Actualizar();  
    }
    } 
  }
);
//***********************************************************************************************
//                    Miniatura de Logo
// El dato del Stretch al 100% se saca del siguiente video cerca del minuto 11
//   https://www.youtube.com/watch?v=dgIIFtfqJJ4
var parametros ={
  bands: ["b1","b2","b3"],
  gamma: 1,
  max: 255,
  min: 73,
  opacity: 1
};

//image = image.visualize(imageVisParam);
image = image.visualize(parametros);
var logo = ui.Thumbnail({
  image: image,
  style: {height: '128px', width: '228px'}
});
//***********************************************************************************************
//                  CheckBox
//                  Punto de calor

var ckbPuntoCalor = ui.Checkbox({label : 'Puntos de calor' , value: false ,
  style: {  margin: '3px 5px', textAlign: 'justify', fontFamily: 'Agency FB', fontSize: '18px'},
  onChange: function(checked) {
    if(checked){
      Incendio();
      ckbAreaQuemada.setValue(false);
      ckbCombustion.setValue(false);
      ckbCicatriz.setValue(false);
      seleccion =  'Puntos de calor FIRMS';
    }
  }
});
//                  Índice de área quemada

var ckbAreaQuemada = ui.Checkbox({label : 'Índice de área quemada' , value: false ,
  style: {  margin: '3px 5px', textAlign: 'justify', fontFamily: 'Agency FB', fontSize: '18px'},
  onChange: function(checked) {
    if(checked){
    Quemada();
    ckbPuntoCalor.setValue(false);
      ckbCombustion.setValue(false);
      ckbCicatriz.setValue(false); 
      seleccion =  'Índice de área quemada (BAI)'; 
    }
  }
});
//                  Índice de combustión

var ckbCombustion = ui.Checkbox({label : 'Índice de combustión' , value: false ,
  style: {  margin: '3px 5px', textAlign: 'justify', fontFamily: 'Agency FB', fontSize: '18px'},
  onChange: function(checked) {
    if(checked){
     Combustible();
     ckbPuntoCalor.setValue(false);
      ckbAreaQuemada.setValue(false);
      ckbCicatriz.setValue(false);
      seleccion =  'Índice de combustión (NRBT)';
      
    }
  }
});

//                  Cicatrices de fuego

var ckbCicatriz = ui.Checkbox({label : 'Cicatrices de fuego' , value: false ,
  style: {  margin: '3px 5px', textAlign: 'justify', fontFamily: 'Agency FB', fontSize: '18px'},
  onChange: function(checked) {
    if(checked){
      Cicatriz();
      ckbPuntoCalor.setValue(false);
      ckbAreaQuemada.setValue(false);
      ckbCombustion.setValue(false);
      seleccion =  'Cicatrices de incendios MODIS';
    }
  }
});
//***********************************************************************************************
//                                  Label
var lbl_subtitulo = ui.Label(
  {
    value: 'La presenta herramienta, pone a disposición elementos de análisis para el monitoreo de puntos de calor, cicatrices de fuego, índices de combustión e índice de áreas quemadas.',
    style: {  margin: '10px 5px', textAlign: 'justify', fontFamily: 'Agency FB' }
  });
var lbl_bajada1 = ui.Label(
  {
    value: 'Fuente de información:',
    style: {  margin: '0px 5px', textAlign: 'justify', fontFamily: 'Agency FB',  color: '1c0dff'}
  });
var lbl_bajada2 = ui.Label(
  {
    value: 'Puntos de calor: FIRMS',
    style: {  margin: '0px 5px', textAlign: 'justify', fontFamily: 'Agency FB',  color: '1c0dff'}
  });
var lbl_bajada3 = ui.Label(
  {
    value: 'Índice de área quemada (BAI): MODIS/006/MOD09GA',
    style: {  margin: '0px 5px', textAlign: 'justify', fontFamily: 'Agency FB',  color: '1c0dff'}
  });
var lbl_bajada4 = ui.Label(
  {
    value: 'Índice de combustión (NBRT):  . LANDSAT/LC8_L1T_ANNUAL_NBRT',
    style: {  margin: '0px 5px', textAlign: 'justify', fontFamily: 'Agency FB',  color: '1c0dff'}
  });
var lbl_bajada5 = ui.Label(
  {
    value: 'Cicatrices de incendios: MODIS/006/MCD64A1',
    style: {  margin: '0px 5px', textAlign: 'justify', fontFamily: 'Agency FB',  color: '1c0dff'}
  });
var lbl_region = ui.Label(
  {
    value: '1. Seleccione la localización',
    style: {  margin: '10px 5px', textAlign: 'justify', fontFamily: 'Agency FB', color:'#ffffff', 
    backgroundColor: '#454545' , stretch: 'horizontal', fontSize: '22px', padding : '0px 12px'}
  });
var lbl_anio = ui.Label(
{
    value: '2. Fecha de interés',
    style: {  margin: '10px 5px', textAlign: 'justify', fontFamily: 'Agency FB', color:'#ffffff', 
    backgroundColor: '#454545' , stretch: 'horizontal', fontSize: '22px', padding : '0px 12px'}
  });
var lbl_variable = ui.Label(
  {
    value: '3. Variable a medir',
    style: {  margin: '5px 5px', textAlign: 'justify', fontFamily: 'Agency FB', color:'#ffffff', 
    backgroundColor: '#454545' , stretch: 'horizontal', fontSize: '22px', padding : '0px 12px'}
  });
var lbl_descarga = ui.Label(
  {
    value: '4. Descarga de capas',
    style: {  margin: '5px 5px', textAlign: 'justify', fontFamily: 'Agency FB', color:'#ffffff', 
    backgroundColor: '#454545' , stretch: 'horizontal', fontSize: '22px', padding : '0px 12px'}
  });
var lbl_fechaInicial = ui.Label('Elija una fecha inicial.');
var lbl_fechaFinal = ui.Label('Elija una fecha final.');
//***********************************************************************************************
//                     Añadir elementos al panel principal

panelPrincipal.add(lbl_subtitulo);
panelPrincipal.add(lbl_bajada1);
panelPrincipal.add(lbl_bajada2);
panelPrincipal.add(lbl_bajada3);
panelPrincipal.add(lbl_bajada4);
panelPrincipal.add(lbl_bajada5);
panelPrincipal.add(lbl_region);
panelPrincipal.add(dropdownlist_de_filtro);
panelPrincipal.add(lbl_anio);
panelPrincipal.add(panelFechas);
panelPrincipal.add(lbl_variable);
panelPrincipal.add(ckbPuntoCalor);
panelPrincipal.add(ckbAreaQuemada);
panelPrincipal.add(ckbCombustion);
panelPrincipal.add(ckbCicatriz);
panelPrincipal.add(lbl_descarga);
panelPrincipal.add(dropdownlist_variables);
//panelPrincipal.add(buttonUpdate);
//panelPrincipal.add(button);
panelPrincipal.add(logo);
//***********************************************************************************************
//Mostrar panel principal a la izquierda
ui.root.insert(0, panelPrincipal);
//***********************************************************************************************
//Se pueden integrar en GEE metodos JS para manipular el DOM, pero dan error pues no siguen la
//sintaxis especifica de GEE.
//Sin embargo podemos hacer uso de los metodos JS al generar la APP.
//Elimina el buscador cuando se genera la API
document.getElementById('main-header').style.display = 'none';

//Se obtiene un Array con todos los elemntos del DOM que tiene como clase "jumptodate"
// https://www.w3schools.com/jsref/tryit.asp?filename=tryjsref_document_getelementsbyclassname
//var x = document.getElementsByClassName("jumptodate");
//Desconocemos el lugar que ocupa en el arreglo cada elemento definido por la clase "jumptodate"
//Los lugares 0 y 1 fueron obtenidos suponiendo que el primer elemento es de inicio y el segundo el final
//x[0].innerHTML = 'Fecha de inicio';
//x[1].innerHTML = 'Fecha final';




// set position of panel
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});
 
// Create legend title
var legendTitle = ui.Label({
  value: 'My Legend',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
 
// Add the title to the panel
legend.add(legendTitle);
 
// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};
 
//  Palette with the colors
var palette =['FF0000', '22ff00', '1500ff'];
 
// name of the legend
var names = ['Red','Green','Blue'];
 
// Add color and and names
for (var i = 0; i < 3; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 
// add legend to map (alternatively you can also print the legend to the console)
//Map.add(legend);


//Map.addLayer(image);
//Map.centerObject(image);
//***********************************************************************************************
//                        Leyenda
//Archivo que contiene la logica de las leyendas
var pkg_vis  = require('users/kongdd/public:pkg_vis.js');
var vis_diff; //Crea el degradado
var lg_vi; //Genera el panel con el degradado y el titulo de la leyenda
//Colores NBRT
var coloresNBRT = ['green', 'blue', 'yellow', 'red'];
var coloresBAI = ['Red','Yellow','Green'];
//Funciones paras el despliegue
function leyendaNBRT(){
  vis_diff = {min: 0.95, max: 1, palette:coloresNBRT};  
  lg_vi    = pkg_vis.grad_legend(vis_diff  , 'Índice de combustión ', false);
  pkg_vis.add_lgds([ lg_vi]);
}
function leyendaBAI(){
  vis_diff = {min: 0, max: 1, palette:coloresBAI};  
  lg_vi    = pkg_vis.grad_legend(vis_diff  , 'Índice de área quemada', false);
  pkg_vis.add_lgds([ lg_vi]);
}

Map.centerObject(Area_Estudio);