import { db } from "../client.js";

export type DB = typeof db;

export type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

export type DBClient = DB | Transaction;
