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
* Flag-image output script.
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
	"cacheidprefix" => 	"php-netPanzer-Browser-flagimage",
	"errorfile" =>		"images/miniError.png",
));

/**
* * Code:
**/

// Include the cache package
require_once('Cache/Lite.php');

// Create a Cache_Lite object
$Cache_Lite = new Cache_Lite(array('cacheDir' => $conf["cachedir"],'lifeTime' => $conf["cachelifetime"]));

if (isset ($_GET["refresh"]) and $_GET["refresh"] == "1") {
	$Cache_Lite->remove ($cacheID);
}

if (isset ($_GET["flagID"])) {
	$cacheID = $conf["cacheidprefix"] . $_GET["flagID"];
} else {
	$cacheID = $conf["cacheidprefix"] . "-error-flagID-not-found";
}

if ($data = $Cache_Lite->get($cacheID)) {
	$cachehit = 1;
} else {
	$cachehit = 0;
	
	require_once ($conf["includepath"] . "Games/NetPanzer/Flag.php");
	
	$flag = new Games_NetPanzer_Flag ($conf);
	
	if (isset ($_GET["flagID"]) and $flag->isFlagID ($_GET["flagID"])) {
		$flagID = $_GET["flagID"];
	} else {
		// No data for this map.
		header ("Content-Type: image/png");
		readfile ($conf["errorfile"]);
		exit;
	}
	
	$data = $flag->getFlagImage ($flagID);
	$Cache_Lite->save ($data);
}
	
header ("Content-Type: image/png");
header ("Cache-Control: max-age=". $conf["cachelifetime"] );
header ("Content-Length: " . strlen ($data) );
echo $data;
?>