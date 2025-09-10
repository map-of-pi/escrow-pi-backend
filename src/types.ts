import {Document, Types} from "mongoose";

// ========================
// USER MODELS
// ========================
export interface IUser extends Document {
  pi_uid: string;
  pi_username: string;
  user_name: string;
};
