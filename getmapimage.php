<?php
/*
Copyright (C) 2004 Tobias Blersch <npb@schrelb.de>
                                                                                
This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.
                                                                                
This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
                                                                                
You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/
	
/* * php - netPanzer - Browser
*
* Map-image output script.
* Images get resized and cached.
*
* * Configuration:
*
* Please note:	  All times are seconds.
*/

/** Include base configuration file: **/
require_once ("base.conf.php");


/** Specific configuration data: **/
$conf = array_merge ($conf, array (
	"cachelifetime" =>	7200,	// Cache processed images for 2h = 7200s
	"cacheidprefix" => 	"php-netPanzer-Browser-mapimage",
	"defaultsize" => 	"big",
	"errorfile" =>		"images/Error.png",
	"imageoutputtype" => "jpg"
));

/** Include list with avialable maps **/
require_once ($conf["mapdatadir"] . "maplist.conf.php");

/**
* * Code:
**/
require_once ($conf["includepath"] . "Games/NetPanzer/Map.php");

$maps = new Games_NetPanzer_Map ($conf);
$maps->setMaps ($avialablemaps);

if (isset ($_GET["map"]) and $maps->isMap ($_GET["map"])) {
	$map = $_GET["map"];
} else {
	// No data for this map.
	header ("Content-Type: image/png");
	readfile ($conf["errorfile"]);
	exit;
}
if (!isset ($_GET["size"])) {
	$_GET["size"] = NULL;
}
$size = $maps->setSize ($_GET["size"]);

// Include the cache package
require_once('Cache/Lite.php');

// Create a Cache_Lite object
$Cache_Lite = new Cache_Lite($maps->getCacheConf ());

if (isset ($_GET["refresh"]) and $_GET["refresh"] == "1") {
	$Cache_Lite->remove ($maps->getCacheID($map, $size));
}

if ($data = $Cache_Lite->get($maps->getCacheID($map, $size))) {
	$cachehit = 1;
} else {
	$cachehit = 0;
	$data = $maps->getImage ($map, $size);
    $Cache_Lite->save($data);
}

header ($maps->getCtypeHeader ());
header ("Cache-Control: max-age=". $conf["cachelifetime"] );
header ("Content-Length: " . strlen ($data) );
echo $data;
?>