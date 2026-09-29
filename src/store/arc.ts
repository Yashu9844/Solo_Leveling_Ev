// The single place that decides which arc (and profile) is "the" arc.
//
// Today the database holds exactly one arc, so this is
// `toCollection().first()`. Every caller goes through here rather than
// reading db.arc directly, so the day arcs become plural (a second arc,
// a platform user's next System — platform/04 §35.2) is a change to this
// file, not to twenty call sites. Works inside a Dexie transaction as long
// as the transaction includes db.arc / db.profile, same as the inline
// reads it replaces.
import { db } from '../db/db';
import type { ArcRow, ProfileRow } from '../db/schema';

export async function getActiveArc(): Promise<ArcRow | undefined> {
  return db.arc.toCollection().first();
}

export async function getActiveProfile(): Promise<ProfileRow | undefined> {
  return db.profile.toCollection().first();
}
