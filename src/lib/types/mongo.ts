// MongoDB extended JSON types

export interface MongoOid {
	$oid: string;
}

export interface MongoDate {
	$date: string;
}

export interface MongoNaN {
	$numberDouble: 'NaN';
}
