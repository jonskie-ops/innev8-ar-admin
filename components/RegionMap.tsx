import type { CSSProperties } from "react";

/**
 * Eastern Visayas as a glowing map on a moving grid, its six provinces wired to the INNEV8 emblem at
 * Palo, Leyte: the main site's closing scene (innev8-nextjs, components/graphics.tsx FinaleBackdrop),
 * drawn in code so it's sharp at any size. Plays inside an element with `is-live is-playing`.
 */
/* eslint-disable @next/next/no-img-element -- the emblem is an SVG, already sized */
export function RegionMap() {
  return (
    <>
      <div className="fin-bg" aria-hidden="true">
        <div className="fin-stars"></div>
        <svg className="fin-warp" viewBox="-800 -500 1600 1000" preserveAspectRatio="xMidYMid slice">
          <g fill="none" strokeLinecap="round">
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1149.6 -19.5 L226.9 -3.8"
              style={{ "--t": "2.50s", "--o": "-1.76s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1144.1 72.1 L168.9 10.6"
              style={{ "--t": "4.60s", "--o": "-0.96s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1098.7 210.6 L178.4 34.2"
              style={{ "--t": "3.29s", "--o": "-1.63s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1060.3 276.1 L199.6 52"
              style={{ "--t": "2.41s", "--o": "-0.57s" } as CSSProperties}
            />
            <path
              className="fin-warp-l fin-warp--gold"
              pathLength="1"
              d="M996.2 356.3 L148.4 53.1"
              style={{ "--t": "3.18s", "--o": "-2.87s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M878.2 460.4 L121.5 63.7"
              style={{ "--t": "2.82s", "--o": "-2.80s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M790.3 517.9 L137.2 89.9"
              style={{ "--t": "3.11s", "--o": "-2.05s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M637.3 593.5 L113.8 106"
              style={{ "--t": "3.39s", "--o": "-2.21s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M435.4 659.9 L74.4 112.8"
              style={{ "--t": "2.54s", "--o": "-0.16s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M274.5 692.4 L45.1 113.8"
              style={{ "--t": "2.67s", "--o": "-2.52s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M154.7 706.5 L28 128"
              style={{ "--t": "4.31s", "--o": "-1.23s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M16.5 712.9 L3.2 136.5"
              style={{ "--t": "2.52s", "--o": "-1.93s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-117.7 709.3 L-21 126.6"
              style={{ "--t": "3.89s", "--o": "-3.69s" } as CSSProperties}
            />
            <path
              className="fin-warp-l fin-warp--gold"
              pathLength="1"
              d="M-361.7 676.8 L-59.8 112"
              style={{ "--t": "2.67s", "--o": "-0.40s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-480.7 647.7 L-79.8 107.5"
              style={{ "--t": "2.37s", "--o": "-2.14s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-622.5 599.5 L-111.6 107.4"
              style={{ "--t": "2.73s", "--o": "-0.67s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-709.8 561 L-109.5 86.6"
              style={{ "--t": "2.84s", "--o": "-1.20s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-859.8 473.5 L-162 89.2"
              style={{ "--t": "4.34s", "--o": "-0.76s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-960.9 391.7 L-136.4 55.6"
              style={{ "--t": "3.79s", "--o": "-3.70s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1031.4 315.4 L-189.5 58"
              style={{ "--t": "2.92s", "--o": "-0.04s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1111.6 182.7 L-171.4 28.2"
              style={{ "--t": "2.61s", "--o": "-1.14s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1133.5 120.4 L-180.2 19.1"
              style={{ "--t": "3.27s", "--o": "-1.37s" } as CSSProperties}
            />
            <path
              className="fin-warp-l fin-warp--gold"
              pathLength="1"
              d="M-1150 -6.3 L-173.1 -0.9"
              style={{ "--t": "2.43s", "--o": "-0.21s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1143.9 -73.6 L-190.7 -12.3"
              style={{ "--t": "3.06s", "--o": "-2.48s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1103.3 -201.2 L-198.3 -36.2"
              style={{ "--t": "4.55s", "--o": "-0.29s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-1067.9 -264.5 L-149.7 -37.1"
              style={{ "--t": "3.13s", "--o": "-1.79s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-952 -400 L-147.4 -62"
              style={{ "--t": "4.52s", "--o": "-0.01s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-843.3 -484.7 L-122.3 -70.3"
              style={{ "--t": "4.30s", "--o": "-0.14s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-711.9 -560 L-130.5 -102.6"
              style={{ "--t": "4.58s", "--o": "-2.65s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-652.6 -587.1 L-129.1 -116.2"
              style={{ "--t": "3.26s", "--o": "-0.27s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-466.7 -651.7 L-77 -107.5"
              style={{ "--t": "3.34s", "--o": "-0.52s" } as CSSProperties}
            />
            <path
              className="fin-warp-l fin-warp--gold"
              pathLength="1"
              d="M-365.5 -676 L-62.4 -115.5"
              style={{ "--t": "3.29s", "--o": "-0.42s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-170.5 -705.1 L-30.9 -127.6"
              style={{ "--t": "3.92s", "--o": "-1.85s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M-12.2 -713 L-1.9 -110.9"
              style={{ "--t": "2.74s", "--o": "-0.54s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M157.5 -706.3 L21.7 -97.4"
              style={{ "--t": "3.94s", "--o": "-2.79s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M336.3 -681.8 L44.4 -90"
              style={{ "--t": "3.07s", "--o": "-1.33s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M434.8 -660.1 L86 -130.5"
              style={{ "--t": "4.01s", "--o": "-2.02s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M641.5 -591.8 L92.6 -85.4"
              style={{ "--t": "2.75s", "--o": "-1.45s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M774.1 -527.3 L135.8 -92.5"
              style={{ "--t": "2.22s", "--o": "-1.36s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M899.2 -444.5 L163.8 -81"
              style={{ "--t": "4.43s", "--o": "-4.35s" } as CSSProperties}
            />
            <path
              className="fin-warp-l fin-warp--gold"
              pathLength="1"
              d="M949.9 -401.9 L143.5 -60.7"
              style={{ "--t": "3.51s", "--o": "-3.43s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1039.7 -304.6 L203.7 -59.7"
              style={{ "--t": "4.24s", "--o": "-2.19s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1107.4 -192.3 L218.2 -37.9"
              style={{ "--t": "4.08s", "--o": "-1.21s" } as CSSProperties}
            />
            <path
              className="fin-warp-l"
              pathLength="1"
              d="M1143.3 -77 L164.7 -11.1"
              style={{ "--t": "3.09s", "--o": "-2.96s" } as CSSProperties}
            />
          </g>
        </svg>
        <div className="fin-horizon"></div>
        <div className="fin-world">
          <div className="fin-plane">
            <div className="fin-grid"></div>
            <div className="fin-sweep"></div>
            <svg className="fin-map" viewBox="0 0 1000 1607">
              <defs>
                <path
                  id="fp0"
                  pathLength="1"
                  d="M139.6 181L122.8 123.5L84 34.8L82.7 26.7L84.2 19.7L88.3 12.4L94.2 6.8L101 5L105.5 7.1L132.4 27.8L135.1 28.6L141.2 28.8L156.1 21.8L161.3 20.5L164.7 21.6L179.6 28.8L188.9 31.8L226 32.4L228.4 33.3L234.9 37.5L236.2 39L237.4 41.3L240.2 40.3L243.5 38.1L246.1 37L259.6 38.3L272.4 41.1L321.3 45.3L432.4 36.6L437.9 34.8L443.6 30.6L448.7 22.2L445.4 16.6L439.7 11.4L437.6 4.5L437.6 0L448.2 3.5L456.2 10.5L462.5 17.4L467.9 20.5L475.7 17L485.8 10.8L494.5 9L498.3 18.3L504 17.6L516.3 22.7L527 29.3L528.5 32.4L531.9 33.5L535.1 35.5L539.4 37.2L546.5 37L551.3 35L558.1 31L564.3 26.4L567 22.6L569 10L574.5 7.2L591.1 12.3L596.9 11.6L602.6 9.2L608.1 7.9L613 10.3L627.2 24.6L656.5 43.1L670.5 55.4L671.5 65.7L677.9 72.6L690.5 79.9L695.6 86.6L702.4 102.1L706.7 107.3L716.1 115.3L705.1 121.6L694.4 134.9L691.5 149.9L704 160.8L700 163.4L697.8 166.8L696.3 173.8L685.5 180.6L671 184.6L661 171.1L646.6 136.5L633.2 129.1L621.1 135.1L611.4 149.1L605.5 165.6L597.7 172.1L588.7 176L569.2 180.5L557 181.2L551.2 182.5L545.8 186.8L538.4 196.5L534.2 200L527.9 201.9L511.4 203.2L465.9 200L451.4 200.6L441.8 205L432.7 211.7L419.3 218.9L405.2 219.3L392.1 212.5L379.1 204.2L365.7 200.1L358.8 201.3L352.1 204.3L339.7 212.1L328.9 217.3L321.3 216.8L303.9 204.9L208.2 156.7L198.2 156.4L190.6 164.8L183.1 175L173.4 180L139.6 181ZM20.7 116L9.2 106.1L2.3 92.4L0.1 79.2L0 72.4L5.3 73.6L15.9 81.3L25.3 95.3L28.5 110.8Z"
                />
                <path
                  id="fp1"
                  pathLength="1"
                  d="M401.4 576.3L405.3 582.7L409.3 587.6L415.3 590.9L425.5 592.7L423.2 599L421.9 605.4L421.5 619.5L419.5 626.4L415.3 631.7L411 633.9L397.1 617.7L398.3 615.6L397.6 609.3L393.6 606.2L385.3 613.5L376.9 592.7L381.1 594.3L385.3 596.8L383.8 587L378.3 577.7L370.6 570.8L362.9 568.1L357.4 565.2L354.8 558.6L353.2 551L350.8 545.5L346.8 539.6L346.9 534.6L352.8 522.6L356.8 522.6L357.6 523.7L363.7 530.2L383.5 542.3L386.2 544.6L388.3 547.4L389.4 550.8L390.2 554.9L391.9 558.4L400.5 562.4L402.2 568ZM652.3 899.5L647.4 897.4L642.9 892.8L639.1 885.2L636.3 877.2L633.1 845L627.2 819.5L611.7 796.8L588.4 786.7L561.5 784.7L534.8 786.6L510.8 782.1L505.3 765.1L510.3 716.5L510.1 711.5L510.6 707.6L511.9 704L514.3 700.1L509.8 697.6L498.3 687.4L494 685.7L485.7 685L481.8 683.7L473.7 678.1L466.9 671.4L461.5 663.5L458.1 654.6L449.3 673.7L443.9 676.5L433.6 675.1L425.5 671.9L419 666.7L413.7 659.6L409.1 650.5L418.2 646.3L423.3 640.7L427.5 634.9L433.6 630L443.3 627.4L451.4 626.4L453.5 623.1L445.6 613.5L480 613.5L487.5 609.5L497.1 600L505.8 589L510.3 580.7L509.9 571.4L506.9 562.2L505 553.4L508.3 545.5L521 531.7L530.5 518.8L533.4 521.8L542.8 527L542.1 512.6L535.9 500.9L525.7 493L512.3 490.1L502.3 493.3L478 507.4L467.9 510.7L446.9 498.6L412.2 448.2L389 440.5L389 436.4L393 436.7L397.1 436.4L391.4 433.5L389 432.7L397.1 415.9L399.9 417.7L402.8 419L405.8 420.8L409.1 424.1L406.6 411.9L398.2 406L389.4 405.5L379.8 415.9L369.5 414.6L364.1 409.2L373.2 403.2L370.1 397.9L366.4 395.4L361.9 395.8L356.8 399.5L355.6 383.3L353.7 374.4L350.8 368.5L321.7 337.4L298.3 328L274.9 322.5L256.6 324.7L239.6 315.8L211.8 296.5L184.3 263.3L171.5 251.4L173.1 250.1L173.5 249.6L175.1 246.9L161.2 238.8L151.5 222L139.6 181L139.6 181L173.4 180L183.1 175L190.6 164.8L198.2 156.4L208.2 156.7L303.9 204.9L321.3 216.8L328.9 217.3L339.7 212.1L352.1 204.3L358.8 201.3L365.7 200.1L379.1 204.2L392.1 212.5L405.2 219.3L419.3 218.9L432.7 211.7L441.8 205L451.4 200.6L465.9 200L511.4 203.2L527.9 201.9L534.2 200L538.4 196.5L545.8 186.8L551.2 182.5L557 181.2L569.2 180.5L588.7 176L597.7 172.1L605.5 165.6L599.1 214.7L593.2 240.1L573 277.4L572.9 303.8L582.4 356.6L630.1 346L636.1 348.1L642.9 355.4L653.4 375.1L659.5 398.6L675.1 619.8L679.7 635.6L709.5 686.3L715.8 707.1L714.5 728.6L707.4 749.5L678.5 801.7L667.1 835.7ZM42.8 306.5L55.6 311L56.4 317.1L44.6 318.7L38.3 323.7L26.5 331.5L18.1 332.6L9.8 328.9L7.5 323.4L11.6 316.2L18.7 310L28.5 307.1Z"
                />
                <path
                  id="fp2"
                  pathLength="1"
                  d="M994.2 1115.6L1000 1124.4L997.1 1131.1L989.3 1135.4L980.3 1136.8L969.4 1137L963.2 1136.2L958.5 1133.1L952 1126L945.9 1121.8L924.1 1111.9L913 1104.8L910 1089.1L914.9 1073.3L927.8 1065.7L940.9 1071.5L948.4 1101.4L958 1111.9L967.3 1113.1L986.2 1112.2ZM696.3 173.8L695.6 177.2L713.7 166.8L720.1 164.5L719 170.3L719.1 174.2L718.8 177.5L716.1 181.3L722.6 183.9L728.3 181.6L740.2 172.7L736.6 184L742.3 186.7L764.7 185.4L775.6 190.9L796.4 206.6L804.9 205.9L808.2 212.4L821 228.5L827.2 245L826.8 251.7L817 246.9L812.2 250.5L798.3 253L792.5 255.1L797.8 257.3L801.9 259.8L805.5 263.1L808.9 267.4L792.7 271.3L785.3 274.2L780.8 279.8L779.5 290.9L785.7 294L804.9 292.5L803.6 294.4L802 298.7L800.9 300.6L806.2 305L813.8 312.7L819.4 321.1L819 327.5L799 343.9L794.2 350.2L786.9 363.2L776.4 376.9L772.7 386.9L771.6 398.6L772.3 411.8L773.4 415.3L780.8 432.7L779.5 451.1L780.8 457.3L784.1 461.5L799 475.6L800.9 481.3L799 486.8L795 489.8L779.4 484.1L773.6 494.8L775.3 505.3L786.8 500.4L793.8 501.1L799.5 512.7L804.9 534.9L804.1 550.1L798.3 553.1L791 554.3L784.8 564L792.3 567.1L790.7 572.8L786.1 580.3L784.8 588.6L787.5 594.1L790.8 595.6L794.7 596.1L799 598.9L800.9 603L800.9 617.7L803.4 626.7L805.8 632.2L818.9 651.4L822.8 660.8L822.9 670.4L817 679.6L821.7 680.1L824.9 680.9L828.4 681L833.4 679.6L836.5 694L839.1 700.9L843.4 703.8L849.5 705.8L860.1 714.5L867.6 716.5L868.8 720L875.2 727.2L882.3 733.7L885.7 734.8L885.9 750.5L884.1 760L879.5 767.8L843.6 795.1L837 807.2L837 828.9L846.9 840.5L863 842.6L881.7 835.9L873 824.6L872.8 815.7L880.5 814.2L907.7 834.2L918.6 840.5L926.7 849.6L929.9 866.8L939.5 885.7L957.9 905.3L969.3 924.7L958 942.5L953.1 937.9L939.3 930.5L933.9 926.5L928.7 906.4L927.5 904.7L926.6 903L926.3 899.6L926.5 888.9L926 886L922.4 885.4L913.7 881L911.2 878.2L902.8 871.1L893.9 866.4L889.6 870.7L869.6 882.9L863.6 885.1L856.5 882.7L854 877L852.6 870.4L849.1 865L842.2 862L838.3 863.6L834.1 866.9L827.2 868.7L825.8 873.2L822.9 894.7L821 901.9L805.1 887.1L794.3 879.5L786.8 878.9L775.7 892.1L769.4 897.6L760.3 901.9L759.9 892.2L755.5 886.1L749.4 885.8L744.2 893.3L730.3 880.5L724.1 876.9L702.8 873.6L699.6 870.7L696.9 866.3L690.4 867.6L672.6 874.7L669.5 879.2L666.9 884.8L660.1 894.9L658.6 899.3L655.5 900.8L652.3 899.5L667.1 835.7L678.5 801.7L707.4 749.5L714.5 728.6L715.8 707.1L709.5 686.3L679.7 635.6L675.1 619.8L659.5 398.6L653.4 375.1L642.9 355.4L636.1 348.1L630.1 346L582.4 356.6L572.9 303.8L573 277.4L593.2 240.1L599.1 214.7L605.5 165.6L611.4 149.1L621.1 135.1L633.2 129.1L646.6 136.5L661 171.1L671 184.6L685.5 180.6Z"
                />
                <path
                  id="fp3"
                  pathLength="1"
                  d="M274.4 617.7L287.3 623.4L289.4 636.1L284.1 656.8L280 663.8L270.2 666.8L234.9 666.2L220 662.5L207.7 662.8L206.1 668L203.9 671L199.7 671.4L196.4 669.1L194.4 665.4L193.1 661.6L191.5 659.1L171.5 638.2L164.7 627.8L148.9 586.9L145.5 573.6L143 568.1L130.4 552.9L126.9 547.5L138.4 548.2L167.5 539.4L175.1 538.5L197.6 539.9L213.3 538.7L218.9 539.7L229.4 543.8L240.3 550.5L248.8 559.5L255.3 580.5L269.7 611.2Z"
                />
                <path
                  id="fp4"
                  pathLength="1"
                  d="M245 966.2L243.4 975.2L250.1 986.2L252.7 997.4L247.3 1011.1L238.9 1023.3L232.2 1029.4L224.3 1032.1L220.1 1031.7L198.5 1014.8L197.7 1013L187.9 1015.8L184.5 1014.4L181.9 997.5L178.6 995.1L171.5 996.6L164.3 996.9L158.1 998.4L154.5 995.8L155 984L157.8 976.3L165.7 965.3L167.5 955.6L165.9 944.2L161.7 938.8L156.2 934.5L151 926.5L150.1 916.6L153.2 907.8L157.3 900.6L160.7 891.1L166.2 883L167.5 878.9L166.8 874.4L163.7 867.3L159.4 829.5L159.4 774.3L149.3 775.5L138.7 769.2L130.2 758.7L126.9 747.5L128.8 742.3L137.4 736.3L139.4 730.9L130 728L122.9 724.9L118.5 720.6L126.6 716.4L124.5 711.4L118.6 705.4L115.2 698.1L113.3 689.2L104.7 675.7L96.6 639.6L98.4 630L101.1 629.1L113.3 623.1L115.2 621.4L121.6 625.1L136.8 646.2L171.5 675.1L182.3 687.6L204.1 724.7L206.2 699.2L209.7 687.8L217.7 689.5L235.6 702.8L242.4 710.4L256.8 747.8L271.3 764.2L292.3 773.3L320.6 774.3L341.4 769L359.7 758.8L389 732.9L411.7 701.1L419.4 696L424.6 697.2L436.5 702.6L443.6 703.8L445.8 702.6L445.5 697.2L447.6 696L451.4 697.2L453.3 699.9L453.9 702.6L453.7 703.8L468.8 703L473.8 703.8L479.6 707.4L492.4 718.3L496.3 720.6L500.9 727.1L499.7 741.1L495.8 755.2L463 761.3L470.6 814.1L501.6 840.8L533 837.3L527.6 846.8L526.5 850.4L527.6 857.4L533.5 869.2L534.8 874.8L533.6 894L542.3 949.8L541.5 975.3L517.8 1049.5L513.8 1078L518.4 1103.7L526.2 1110.7L561.6 1127.6L576.1 1132L581 1134.6L583.2 1139.4L587.1 1157L609 1183.3L603.2 1187.8L590.5 1191.8L581.1 1197.4L573.8 1205.5L567.3 1216.8L557.6 1230.5L546.1 1237.5L532.2 1240.5L489.2 1244.4L476.3 1247.2L465.1 1253.2L457.5 1261.2L449.3 1272.8L443.2 1285.4L441.8 1295.8L454.8 1375.9L453.5 1391.4L447.9 1395.1L434.7 1397.5L429 1399.6L424.5 1404.8L419.3 1416.1L414 1420.4L388.9 1433.9L372.4 1445.6L372.4 1445.7L372.3 1445.4L375.9 1421.8L384 1397.5L389 1375.2L387.9 1361.4L383.5 1345.1L375.4 1331.6L362.9 1326L356.5 1319.5L354.5 1304.5L355.2 1288.1L359.4 1260.4L360.8 1255.8L363.9 1250.7L371.7 1241.1L373.2 1237.2L373.9 1210.2L376.1 1198.1L391.3 1161L393 1149.5L392.8 1121.7L380 1063.5L376.9 1057.8L356 1039.4L352.8 1035.4L350.2 1024.4L344.2 1012.9L328.7 992.5L304.2 973.7L300.2 969.8L296.6 959.7L287.8 955L316 917.4L277.1 862L250.4 889.1L214.6 890.5L208.5 916.6Z"
                />
                <path
                  id="fp5"
                  pathLength="1"
                  d="M684 1574.7L690.5 1594.7L689.8 1597.5L684.7 1599.6L681.8 1603.9L678.1 1607L671.5 1605.7L667.7 1602.5L666.3 1598.6L665.6 1594.2L663.5 1589.3L649.4 1572.5L627.2 1535.6L607.2 1523.5L596 1514.6L591.1 1505L584.3 1479.1L583.5 1465.9L591.1 1457.6L598 1457.4L603.5 1460.6L613.5 1469.7L637.7 1479.2L645.2 1484.3L651.1 1494.7L659.4 1535.6L665.1 1543.2L673.4 1551.8L680.7 1562.1ZM609 1183.3L610.3 1184.8L613 1189.8L624.5 1194.8L625.5 1207L619.3 1237.2L620.5 1244.8L626 1258.1L627.2 1266.1L625.9 1288.6L627.2 1296.9L631.3 1305.6L639.1 1317.7L646.9 1324.6L651.4 1317.7L655.4 1317.7L662.8 1326.8L667.2 1335.7L669.8 1346.9L671.5 1362.9L672.7 1376.6L671.1 1390.1L663.3 1400.2L645.2 1404.3L604 1387.8L593.2 1389.6L589.1 1402.1L590.7 1419.7L595 1436.3L599.1 1445.7L579.1 1438.4L562.3 1419.5L550.7 1396.5L546.5 1377.3L537.7 1365.2L536.7 1362.9L534.6 1359.6L534.8 1338.3L527.9 1331.5L516.3 1326.9L504.9 1328L498.3 1338.3L506.1 1355.9L510.3 1437.1L524.5 1475.3L528.2 1500.7L535.1 1527.6L534.8 1539.7L528.9 1544.9L519.2 1541.4L487.9 1516.6L486.2 1513.4L483.2 1505.3L476.1 1502L467.9 1500.7L461.8 1498.6L452.6 1489.2L447.7 1481.4L441.2 1476L427.5 1474L401.4 1473.3L389.6 1470.9L380.9 1465.8L372.4 1445.7L372.4 1445.6L388.9 1433.9L414 1420.4L419.3 1416.1L424.5 1404.8L429 1399.6L434.7 1397.5L447.9 1395.1L453.5 1391.4L454.8 1375.9L441.8 1295.8L443.2 1285.4L449.3 1272.8L457.5 1261.2L465.1 1253.2L476.3 1247.2L489.2 1244.4L532.2 1240.5L546.1 1237.5L557.6 1230.5L567.3 1216.8L573.8 1205.5L581.1 1197.4L590.5 1191.8L603.2 1187.8Z"
                />
              </defs>
              <g className="fin-provs-glow" fill="none">
                <use href="#fp0" className="fin-prov-glow" style={{ "--i": "0" } as CSSProperties} />
                <use href="#fp1" className="fin-prov-glow" style={{ "--i": "1" } as CSSProperties} />
                <use href="#fp2" className="fin-prov-glow" style={{ "--i": "2" } as CSSProperties} />
                <use href="#fp3" className="fin-prov-glow" style={{ "--i": "3" } as CSSProperties} />
                <use href="#fp4" className="fin-prov-glow" style={{ "--i": "4" } as CSSProperties} />
                <use href="#fp5" className="fin-prov-glow" style={{ "--i": "5" } as CSSProperties} />
              </g>
              <g className="fin-provs">
                <use href="#fp0" className="fin-prov" style={{ "--i": "0" } as CSSProperties} />
                <use href="#fp1" className="fin-prov" style={{ "--i": "1" } as CSSProperties} />
                <use href="#fp2" className="fin-prov" style={{ "--i": "2" } as CSSProperties} />
                <use href="#fp3" className="fin-prov" style={{ "--i": "3" } as CSSProperties} />
                <use href="#fp4" className="fin-prov" style={{ "--i": "4" } as CSSProperties} />
                <use href="#fp5" className="fin-prov" style={{ "--i": "5" } as CSSProperties} />
              </g>
              <g className="fin-arcs" fill="none">
                <path className="fin-arc" d="M399.1 108.4 Q241.2 513.7 504.3 860.1" />
                <path className="fin-arc" d="M477.6 493.6 Q593.6 669.4 504.3 860.1" />
                <path className="fin-arc" d="M736.7 523.6 Q526.3 626.8 504.3 860.1" />
                <path className="fin-arc" d="M212.4 603.2 Q430.3 649.9 504.3 860.1" />
                <path className="fin-arc" d="M385.3 1002.7 Q484.7 964.7 504.3 860.1" />
                <path className="fin-arc" d="M532.4 1354.8 Q379.8 1115.3 504.3 860.1" />
              </g>
              <g className="fin-pkts" fill="none">
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "0" } as CSSProperties}
                  d="M399.1 108.4 Q241.2 513.7 504.3 860.1"
                />
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "1" } as CSSProperties}
                  d="M477.6 493.6 Q593.6 669.4 504.3 860.1"
                />
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "2" } as CSSProperties}
                  d="M736.7 523.6 Q526.3 626.8 504.3 860.1"
                />
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "3" } as CSSProperties}
                  d="M212.4 603.2 Q430.3 649.9 504.3 860.1"
                />
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "4" } as CSSProperties}
                  d="M385.3 1002.7 Q484.7 964.7 504.3 860.1"
                />
                <path
                  className="fin-pkt"
                  pathLength="1"
                  style={{ "--i": "5" } as CSSProperties}
                  d="M532.4 1354.8 Q379.8 1115.3 504.3 860.1"
                />
              </g>
              <g className="fin-nodes">
                <circle className="fin-node" cx="399.1" cy="108.4" r="9" />
                <circle className="fin-node" cx="477.6" cy="493.6" r="9" />
                <circle className="fin-node" cx="736.7" cy="523.6" r="9" />
                <circle className="fin-node" cx="212.4" cy="603.2" r="9" />
                <circle className="fin-node" cx="385.3" cy="1002.7" r="9" />
                <circle className="fin-node" cx="532.4" cy="1354.8" r="9" />
              </g>
              <g className="fin-palo">
                <circle className="fin-ring" cx="504.3" cy="860.1" r="34" />
                <circle className="fin-ring fin-ring--2" cx="504.3" cy="860.1" r="34" />
                <circle className="fin-core-glow" cx="504.3" cy="860.1" r="34" />
                <circle className="fin-core" cx="504.3" cy="860.1" r="12" />
              </g>
            </svg>
            <span className="fin-pin" style={{ "--x": "39.91%", "--y": "6.75%", "--i": "0" } as CSSProperties}>
              <i>Northern Samar</i>
            </span>
            <span className="fin-pin" style={{ "--x": "47.76%", "--y": "30.72%", "--i": "1" } as CSSProperties}>
              <i>Samar</i>
            </span>
            <span className="fin-pin" style={{ "--x": "73.67%", "--y": "32.58%", "--i": "2" } as CSSProperties}>
              <i>Eastern Samar</i>
            </span>
            <span className="fin-pin" style={{ "--x": "21.24%", "--y": "37.54%", "--i": "3" } as CSSProperties}>
              <i>Biliran</i>
            </span>
            <span className="fin-pin" style={{ "--x": "38.53%", "--y": "62.40%", "--i": "4" } as CSSProperties}>
              <i>Leyte</i>
            </span>
            <span className="fin-pin" style={{ "--x": "53.24%", "--y": "84.31%", "--i": "5" } as CSSProperties}>
              <i>Southern Leyte</i>
            </span>
            <span className="fin-holo" style={{ "--x": "50.43%", "--y": "53.52%" } as CSSProperties}>
              <img
                src="/assets/img/logo/innev8-emblem-reversed.svg"
                alt=""
                width="120"
                height="185"
              />
              <i>Palo · Leyte</i>
            </span>
          </div>
        </div>
        <div className="fin-vignette"></div>
      </div>
    </>
  );
}
