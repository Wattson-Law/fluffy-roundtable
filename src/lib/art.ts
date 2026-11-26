// Runtime imports of the approved artwork: originals stay at their archived paths.
import room from "../../docs/visual-target-v6.1/source/assets/小屋/room.webp";
import shell from "../../docs/visual-target-v6.1/source/assets/小屋/blank.webp";
import table from "../../docs/visual-target-v6.1/source/assets/小屋/table.webp";
import rail from "../../docs/visual-target-v6.1/source/assets/小屋/rail.webp";
import clouds from "../../docs/visual-target-v6.1/source/assets/小屋/atmos.webp";
import ink0 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink0.webp";
import ink1 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink1.webp";
import ink2 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink2.webp";
import ink3 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink3.webp";
import ink4 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink4.webp";
import ink5 from "../../docs/visual-target-v6.1/source/assets/桌宠/ink5.webp";
import catRest from "../../docs/visual-target-v6.1/source/assets/对话/cat0.webp";
import owlRest from "../../docs/visual-target-v6.1/source/assets/对话/owl0.webp";
import dogRest from "../../docs/visual-target-v6.1/source/assets/对话/dog0.webp";
import foxRest from "../../docs/visual-target-v6.1/source/assets/对话/fox0.webp";
import cat from "../../docs/visual-target-v6.1/source/assets/对话/cat1.webp";
import owl from "../../docs/visual-target-v6.1/source/assets/对话/owl1.webp";
import dog from "../../docs/visual-target-v6.1/source/assets/对话/dog1.webp";
import fox from "../../docs/visual-target-v6.1/source/assets/对话/fox1.webp";
import c0 from "../../docs/visual-target-v6.1/source/assets/入场/runcat0.webp";
import c1 from "../../docs/visual-target-v6.1/source/assets/入场/runcat1.webp";
import c2 from "../../docs/visual-target-v6.1/source/assets/入场/runcat2.webp";
import c3 from "../../docs/visual-target-v6.1/source/assets/入场/runcat3.webp";
import d0 from "../../docs/visual-target-v6.1/source/assets/入场/rundog0.webp";
import d1 from "../../docs/visual-target-v6.1/source/assets/入场/rundog1.webp";
import d2 from "../../docs/visual-target-v6.1/source/assets/入场/rundog2.webp";
import d3 from "../../docs/visual-target-v6.1/source/assets/入场/rundog3.webp";
import o0 from "../../docs/visual-target-v6.1/source/assets/入场/runowl0.webp";
import o1 from "../../docs/visual-target-v6.1/source/assets/入场/runowl1.webp";
import o2 from "../../docs/visual-target-v6.1/source/assets/入场/runowl2.webp";
import o3 from "../../docs/visual-target-v6.1/source/assets/入场/runowl3.webp";
import reading from "../../assets/action-poses/v1/poses/liukanshan-reading.png";
import sleeping from "../../assets/action-poses/v1/poses/ginger-cat-sleeping.png";
import thinking from "../../assets/action-poses/v1/poses/owl-thinking.png";
import laughing from "../../assets/action-poses/v1/poses/shiba-laughing.png";
import looking from "../../assets/action-poses/v1/poses/liukanshan-magnifier.png";
export const art = {
  room: room.src,
  shell: shell.src,
  table: table.src,
  rail: rail.src,
  clouds: clouds.src,
  reading: reading.src,
  sleeping: sleeping.src,
  ink: [ink0, ink1, ink2, ink3, ink4, ink5].map((i) => i.src),
  resting: { purr_cat: catRest.src, owl: owlRest.src, shiba: dogRest.src, kanshan: foxRest.src },
  portrait: { purr_cat: cat.src, owl: owl.src, shiba: dog.src, kanshan: fox.src },
  actions: { purr_cat: sleeping.src, owl: thinking.src, shiba: laughing.src, kanshan: looking.src },
  entry: {
    cat: [c0, c1, c2, c3].map((i) => i.src),
    dog: [d0, d1, d2, d3].map((i) => i.src),
    owl: [o0, o1, o2, o3].map((i) => i.src),
  },
};
