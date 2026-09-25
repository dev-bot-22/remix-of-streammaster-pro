import { defineModel } from "@/lib/pgstore";

const Promotion = defineModel({
  collection: "promotions",
  defaults: () => ({ title: "", message: "" }),
});

export default Promotion;
