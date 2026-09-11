// PRUEBA TEMPORAL: compara carga de imágenes de producto desde GitHub Pages vs Google Drive.
// No modifica el catálogo de producción. Se usa solo desde prueba-imagenes.html.
(() => {
  'use strict';

  const DRIVE_BY_CODE = {
    '0578':'1RPveJO6qfFlN2CI1uERkv3R0ruJSQLd-','0577':'1tJQqFv_FPUWUfMtSGwrVvhuaY0DUIUbv','0576':'13Km-wX2fRQs77vMveTpgvS4b3EEPspwz','0575':'1IXi_vBLyzY31sSvpk5ZmBoC47Wt-Fq5Y','0574':'1S6WJ0QjJUcAWrWDlEMYkmHkeXXjN0IVl','0573':'1_tb89XfxnmREYnx5tmF4IErMOX7WQua1','0572':'1FBAEiaBMCpDvsGpu5kIzDqUB02iAKrup','0571':'1-9PXxRoNyJH8d22F_RrQhQBXVtah8mZx','0570':'1570PrRu-XRFRR2OJtFJV8uc_OKdRfQUa','0569':'11b_9tvPjbxwuZ_dv9_cZrc_O7DOU8rGC','0568':'1g5kh9jrm-cpeTtOoC0aGqhTfarXh5Pbs','0567':'13r_8_9iySlDdsE_D-quJaT3QgG-I1aKu','0566':'1cj-cBMSd98_dSfrY9AWkdHFixXjPeyhW','0565':'13q-tjMRf13R3iC3PnjTu_-c-8zuzHZkQ','0564':'146og2ibnT9tf0IYh8OGGFqBkWYOrxwtB','0563':'1cCYv-OPYwPyyArka8e79kOWmL6sM2Hr4','0562':'1NBpEzfqV7k8A0OAUmjHNSEuDZO-DHMKw','0561':'1Z5b4Xd49u4vCL6GXPddz9jAiwo4xeOlV','0560':'1BqxopMTw_lgxjwNJ0edRcG60g1ArwLl5','0559':'1HW3i4lDG_PROmbamjA0WkfNlIV9Gfr6M','0558':'1ujTTj4PTpD_I0SeJ-Gfmb0UQ-HkSJan-','0557':'1YBG11nXQRxcXuVqV7hBoarUPaKKVRPgg','0556':'1MMuyrWKTY30CLs3wfH-QFl5AIcTFVsJO','0555':'1l4Tf1h128RbFMuKjuCEE0j9t1sPBjJeb','0554':'1M39_ZJ0p7jPkfKwfqsxx9Q41hvTBuOSb','0553':'1HEE_YtxbCi8PYF6lQ9FejUyD--riv2Dj','0552':'1V-rFwZIEN1IkpfpnmYs_0GEoqkCVzKli','0550':'1AeFMNmshziDz47pgjGu1fYsjUHlUruRs','0549':'1r0_qCPfqmOn6ZnSgTv7x87Iy18NXIu7F','0548':'1Y4LGqEsLLwobednSzIUu1l_hdbzS4bkc','0546':'1j5tqcoapQNx3L6hL8hH6v3oXhQiM0F2Q','0545':'1eGuQ7OdmK_wSVE1WztlU4KuOH56sXNxE','0544':'1Md4IM_a9biCZ5ZXRdu3uXlKDgdgp4neJ','0543':'1CCYHfjC9n09Ph-ZbtdC9J2QOn44CimOg','0542':'1oETf_6uPSJA5jkflr419vYWwUp2mW56Z','0541':'1rBiGhrfa5z6QZUPw8LhY8r9mFiup23pB','0540':'1FfbboeOkb2XYYVZTapQCWTzwFD3f7y_x','0539':'1kauWD95OKSfiCMnXybwPUYKlauvkaW9k','0538':'1JOga2MEPXWysK2fM_lCI7DhqrvduH9jL','0537':'1xUVErrkSWzBkFOD2fD0JCemG1WFnR7O3','0535':'1b1dCLPvCrJuvAVI_EcNzgFpt3652jIiH','0534':'1xRV0RjBAuel3V0oPNWH5o9IFPyAxZZam','0533':'1SN2SRDQqZ6_zAc6pQvG8ODUQTGfvfNri','0532':'10ZWB3mQg8os8rmTlzEwe2zM5CKfJZwYc','0531':'188oL7mtfwdNbENcwutg0ObxlgEWUzFsd','0530':'1Di7HFaZm3SV061ry9Xv_2XF6JorlZPAh','0528':'1SniRNPZOUEzTnb7m0Yza53X5d7XJSnFh','0527':'1culUoyuUjv-UkAPw0mNqFJ-Cr6ftBe8r','0526':'1eki8cqS_9TUc0vaI99CBlhbqTkveq1HO','0525':'1O8dGcNm5FZzJhSiLDlBJRGOyQ2RSiMXE','0524':'1OeNVuH-c1T8cqE0FI6uWs8gJOOGNX4SP','0523':'1mZnkGC9XkHMDBWRDMhuRK8ZayFvGXf2Z','0522':'11XuKQb90z_d8K-pQEChBHKiSldQ4trJy','0521':'1bnhJQI-NthDt_Li2hwSAFfiGYd-IWX1U','0520':'1RXhaVb631lM9xltZ262mvIYmfDvgzSlG','0519':'1VNlT3fOslpdT2xYcaRyNhxmVjROYOKDG','0518':'1BrQoTbufZ-JPX1bPKzBodfFQxlGFTzGk','0517':'1DutdzVtKVPSMu6wwo5GsgtN5ULeGly1E','0516':'1Rac5qa3V2KUZmMr8iajjye5Ti-ESSVTQ','0515':'1cuIlkPH0qpe6XhA03MmLkpVstTA00OXg','0514':'1rZTc-cEXErNLhBTi6iT5PTlo4KHQOemb','0513':'1mNvNmyUYpz3qBi5Z6YGHVSOOuaVRKwN4','0512':'1OV1B5pUQKZkqr6WJGPV7EMEqkuiHUMbI','0511':'1nAwS7MB4KPxJonpCccwb3tyQPuex5ipD','0510':'10pkyoGVELmWlAwBe0FwUY4wujNDF3vin','0509':'14n1C7xP45ol8Yb0rUU9NPo5sucMzKpGE','0508':'1Tj-oTz6VnqKU5mlzwMeaWiwQX-YeYche','0507':'1lXyqdMz5fmAByZMwwtAP-ymEWwDJk8Zb','0506':'1mNa9_nFg56GkN6rrlcDJ2Mh2tcHlh1vY','0505':'1CpKggHBNsRixO2V4bdALDglmlUkV0Fuf','0504':'14Zq0WMlAgo8ZRTyOtkC7idpuHzUT04RR','0503':'1o9prM8Xe8i4MWXhDW1ia4fy9rlr7STMy','0502':'1a9wdGgWBXkkh16exMzJ1JCGzjioP9-Fn','0501':'1ruKN8S1u-IQIuR_B2wTOknFzVZnwqp_H','0500':'1ZNDcL5iS7rqYC6hWhYZ2eRHc88ZgdROB','0499':'1rsLmlp0L0BB3Q7kN55M1CifX4P3wD4nf','0498':'1P3SsOZbMLIY9ie5qNB164BmRF8WoTM4P','0497':'1_sGh4rEaOVJLmVkXBO8jtPfWqAPnhhsW','0496':'1IUJ7io-9MjBTjIAimcA2v0j_4HYeADMC','0495':'1R5ss75ZqgiVdl9yRHHaEGULwMs6wzRnz','0494':'1ayGF_WjysvbRKTsRDwV6SCbsImBGYbak','0493':'1d3mAwTLoCGW2ItE3laBAkGsX7TlXw0d9','0492':'1OS4oEtnvQs-y77DU1FZVZUoLcuWdwzBc','0491':'1Yvb941KQFVDY5-rfmLKSDXFpLRTF5jlJ','0490':'1AbFU5KPuost3MazS0lfE-t7EGDl7P8oP','0489':'1_IdASOm5Fg3CUlmZbjGpMow2Y1aM6Kpa','0488':'1fsuF3XIxU3Qvm1hX2bXbP34OGJtM8fuZ','0487':'1vYwRUHe-IHnQ8BnZQDToJ1akPJbpREU3','0486':'1mjP3_pWubhU-qHRZxX_NvwXfbkFMamEI','0485':'1RVp2k-3eGkXYtAp8a8xDBrgewYBFog8W','0484':'13L1UaWcwTtdlKehwDj9xZrRSKofOHA-4','0483':'17OTUY2kLDx8KhRu5U3Hkt2fARu0kcSrD','0482':'1zrQx7XS6PlbaNrN3hmKlDOLQutqj6YCF','0481':'1Kqqq3InwYxl5D0eta0iUpKRHrHWcA5jZ','0480':'1hdoVmrzQpJtiZmM3MPQRMu1j2_eRoAQY','0479':'1ihIEAA33wMRiYu8nU40dnl23DP4X8DjR','0478':'1vG2_Qsvzw3SxbY-HQ56oRNzU2cyAu3au','0477':'1wbha0eFdq30fPlJmCbijM7HMg528rK2P','0476':'1g48C0MFyh1-o-uvB2AAov1pAzZbUsdLn','0475':'112MXiGb1jzzasz1jhvbqq8w6vFDOl4iC','0474':'1ZTvEBMhAf4kD9FS_-ek5Xucs6gob-eDO','0473':'12Fr4fWEquibpUrThtHWh5-uE__Au7Sog','0472':'19zKEcSuZxmH39H1lw9XuqQ2slwO_dcnF','0471':'1o_kuqX2BiacV7EHIRLag0vHsrddeeY8G','0470':'15A7iATFTE53OYl2UjNf0fM-vwIq5HMFo','0469':'1gWC8gdnEFWS9ARwWU9nsKOlxmrQdm5F4','0468':'11Rn56QyqPRC9O05_rFakZ9IkcT-5MXvK','0467':'1UvFOQO7Vx2PipHU6MslgDk9VUpdXFrJX','0465':'1yYLiZnBB_RIh0ZaGibUtO3D_JQm5NQy5','0464':'1iIBX9jPTbbrbirKrc9GsT34cyapwJZFj','0462':'153bQyZ4YtC2LJBYLtSWA1j1Pv2HVteac','0461':'1c-5f-vSTtDVUwzevjjAjLjpuZ7hnLWxx','0460':'1GbOHo5OKEcQTATkxjRH_WnlMYtkHctRc','0459':'1Mv4nKOre-LG5awUNJaeNvbPi31fvcpy9','0458':'1g3mm4eXKPpCi0QmOgj35IzAOciHC7dUf','0457':'1v7LE598Mg2yjTCcxHQwgh_Ie00ICXsHl','0456':'1vuJyp8cabYVBQcyWrcY0mjsClMNHFZ5D','0455':'1_kngTGTAI6EwtQcDZQW7yBRwSlnAN2lk','0454':'14ChFEyz4Wa41uCdfhu3kuPlX6FLOBFAf','0453':'1Bx6plhdcfU3jQEDHEeqPubNlyNWlb31y','0452':'1m15zFbgs4kfUEmIFLZ7UOAbXJLg1ZLwr','0451':'148O636jquIU58MszHV0UNvJwPeo3tYxk','0450':'1zvNj5-Kdea9gD7TVu8feQGpBVbLa2Rpr','0449':'1ZG5rVazSrvEXUuYz9sjJIjYxRS7M6A6a','0448':'1m5qR6kdJIUrUqVZHcNNngCOG2Ds-TNay','0447':'1a_F_yS7XT-seWw4qTUdjBAyxrlEVrjma','0446':'1h92DK6lF_4u0E2kWhK5CgMvUuEXY3HrZ','0445':'1jy_QfuLrbGRBaDT4XFhQjnZtDyw0jHNN','0444':'1HfQHsOLjCaEvmG_ZPf_t5P0MjZzRquss','0443':'1dZKGUIAUwusO1LIxqgMG7kFF3U_LuS83','0442':'1NhlaVrOJ6X9FbAvaBROuZaq_w3FToRlj','0441':'1ba8bz0llVh6Lx11cfivaQR1VqP2n1IO8','0440':'1TCh5fdp-PVxarHRItOzpdG6lP3nz_LBe','0438':'1f3w7XYlEMzeE-8IaEbF3lU8JIqJVQtHu','0437':'15tdgydLG4iMJNZc4kQuxGH5uhCkgHKdW','0436':'15AxdDhHibtak6qAmB4LrCjWmUH8iEWMo','0435':'1rv3APzGdF3QU-rbFcsnX7EPCKCGx4kc4','0434':'1-k9rSI6XfWSx-MG490DJnokKcRO43iIX','0433':'1pvMd5LJsBUNCqG6CR3fjaaTWAwETl7eA','0432':'1-X0NKIu2C0PfKi5w0sQ-oMsW8M6uVhuo','0431':'1a6CSP6vADi2FTpRQZ72qD6hsuGRjyYIr','0430':'1bKlJng6BmJ2_ggZDRogK1dQRCJRWjE2k','0429':'1K9YS0axMaCt3pJZ_LsTw-Cx37j3S5jSh','0427':'12HLGJRiagccXOXTIwsZtIHBhr6Mj-FOX','0426':'177BJxaY9kS6ctGb17qbpQMoupP100g4t','0425':'1Ey2ANusI3LsYevOgpp8ke-VYYNAbFyCn','0424':'13tf8Gb6H1jueCO3CF9bhpiUb8FpmqPew','0423':'1yZqjA0lQQ1uxTDz1uxVv7_dv3LciLQYl','0422':'1qmmgThszH5iNYYdkl0tmIt4USHrK57Nw','0421':'1-XNdiIhM537nzN1Trv_4vWAikmhDTWvo','0420':'1JmrXMomei8XS_UYy7SuFyeDZDLgvzsgv','0419':'1VpunQmwTMRN67dHfNC-tnbPaS_8EYlqu','0418':'1SVWNgwAWyBQcADVXOIU-tOpcRksCUiSJ','0417':'1UHvx2OshATvGbPdH4URznYK_qYbPpHRo','0416':'1fgvjWY7TsgbQnGK7ujbd5jUZDlfGkC93','0415':'1IE953Z2A_FOjuZIzDuvuMYHt5J0POJ6L','0414':'1rtrTg3id2oAXJKHnMqdzCgZgfr2KVm6e','0413':'10nM3KP4tdpiceXPgth_QnhziUGAoNafq','0412':'1DRLoIZlxonhtNGaBjqjXTv1FQbqWJiet','0411':'1SuJg-H1OTtiIokOF3vcf0YFV3sQpcpJp','0410':'1bgE258i-800vnQ1blz5VBIwuZHH22kxn','0409':'1dQAcoMJHj69VDIq9_p55_mQ1APGoajLR','0408':'1Cidhrd3NL2LDnrcMVj0_wR8j4hFZFjCb','0407':'14rIoRB56FezPsNddGJ3PTf3mLwX_9nWC','0406':'14viWDz1Pqyqg37ASFGkf-HYegtQ3lf4y','0405':'1sE-wwT-Ej5o8xv9M1WQo84-7M4OQSOam','0404':'1SwXIhSC_Nc4ODu32Gya0w6VpuECEnhGH','0403':'1AkYg80vK5vCXTq_a9tgnaHG6nT3v6vvN','0402':'1lZOlEVYiVJCohnJieSvLtT5BzchjtjYE','0401':'17OsIGOiDb_07dZ0uooLM-a89vNkNFME1','0400':'1IuW2XK_x8hod3j1_RWc6r2aLM3E1_e_p','0399':'1pyLGwusQlQrDPCIG2bo0cahxkTIyPiA0','0398':'113cS_rpa9O3aJ6Ra8MAacfkTvcDUE-Lj','0397':'1ZOhB3TgGJDk-aTz9AzE4-UIijQmfyXz5','0396':'1bIVVmKYW3THlJwBFCwBoHoZsFRxMPvlb','0395':'1i8wHJ2dG3tpCum44CksRHMR0T3-2b8Ll','0394':'1pJXPHOk-IUm-FrNnxtbjAWd0HQBFP3l5','0393':'1DWJ5kp_uDOQqBA899FYsutjcS--80eft','0392':'1gicxJO5sW4L8YNpS-afhg0SmW2G_Gmc5','0391':'1KpijR0_ok-5AR4w7N5PltMYTMXmzv1qf','0390':'1Cq72pYo-Y374o3QDuLD-jXUR78vrDrBC','0389':'1z-pvPQAJCggcaTz7D9PCywnrIGsFc7Ze','0388':'19vsXPEZu7WxUvu2WkDwT9K-4ufEIxDG5','0387':'16Us4P4FJwatTSZQrkJbz0n_p0i34Va4g','0386':'1B6wX1gWjgLV-2maU-Y9lEYZkAeFkXD1k','0385':'14qYRkmJWt1TTETLny95fcUoW3MSkYCV_','0384':'1alUKmg9r9OgCV0RLzFs4D4uask_q28Je','0383':'1lqwgVmP9hohsZQgT7gfZi2pH29sI9HA7',
    '0275':'1R6uvoS0IycUCzrShDo6Vnlfqy9sMq-Fi','0274':'1goNqpom4rHyMOKc9GOszPNsnaxZHCPbr','0273':'1YXHRtjc0d-pAi250HCZPyl4tvDdpZTIl','0272':'12u0CvQQhW3rkCyyWwVSxnRxq2rdTGRwG','0271':'1329qoXDUHjLGqlFdUQ9ROvSJRAgk_zYb','0270':'10RNiuyz1Hp0pkvOlvUsU2l1UAwjxaVl8','0269':'1-kpfvsXE3OVuIHc25EIL1z4qWnD-KnAk','0268':'1M4y95XtDrnfaLwnH21B7W9gUlX6tEh9j','0267':'1B_PWW_LG4BJW-lvKFbwsVtfFkZR8IGs5','0266':'1xuIBGSixdPWGUcCyoe_4fMEtD-Vix7ro','0265':'1DpkZtPgYK_PyX0kjIyZn-bPm2NPDfdhE','0264':'1Qupo2z52i4HELPEFePzLQ3RvxqRPYx8C','0263':'1eyvWss7p5HpoQwmJkKmD1TF8bQEDcJ0M','0262':'1Aqnz4h2xsFA_vbR4fRFT5xDzH1lgw3Kz','0261':'1j1iEUGyrbwdEhDzhuUcfC4f6hHBJfGqS','0260':'14Si9x0iqFN4Iw7cVPrN1T8gL-QfGBYHu','0259':'1rDI-qZ1WvBsMKr_5gtGpk1gNczfelxGk','0258':'1a1tFobgv2dS1wqA_XEi1M_08v4WIarb-','0257':'1DaBhz6WABiwsM2ekR8wAZb6EK_tfBMKu','0256':'1wat-a_XHRDgZrbfEBKzq-z9QT4jD1JwY','0255':'1-TVhr7QnJJV_bP0jxxL6c0hlppHVLyhV','0254':'1cEIM6DzGV-KCxOo06w0LRF15rCawzILP','0253':'1up5rxombFwRiNI3KIrfaFvXoEGef-r1k','0252':'1C91SCMIn52UO4jU38kOa-fLZ6RseDmYD','0251':'1rks3VHfFU1nhqdgTRPg8lwBdPxK61Pcj','0250':'1DXi1CENkYSYXZBWpOSRkbEyJZD97cast','0249':'110xJxvMOmr2pqFPDinuMJG_YiyKjW9kq','0248':'1AThWe91wWo4s_Kth7hlmhqZeTWUT9uB0','0247':'1nMTGuAd4wS8sDLIUDk0vM6Gby1W52CsA','0246':'1X0FL7IUEIjZDmwQtjpkhjL82PpDVhiC2','0245':'1gNQYWKoEVSfRarNkelDqAqlQ-Edz8McO','0244':'1YwbuWw-7R-MkEBBM4UxnlcHlTWWbVBRR','0243':'1LiPC0vz3PDLw1mNI-HNSew3QD2nOALaS','0242':'1nFrYCoKdMAj0RimlgZ068Ou0YMOXq8l2','0241':'1mucLbySeAf4PaFGff3GO3ZXoqaXbPIHr','0240':'18OHsU_DdQIr3-NK4KxoiaAqzG5CWFLuv','0239':'1NIUg44PHg_epi1msCJ2HTBOR441hD1QW','0238':'1ssOXqknSj8MPaZtiorm6QDIxoeFYMxF6','0237':'12_NqtbEL6f_ghfhskAmh1AI1YNUb40hg','0236':'1umfwKHgxCl_KZl5m30ZqO5txaF4f-kJj','0235':'1IWBY0YYOyDHeiZflsbgjI3u43VOrbd9b','0234':'1NHVEj-iS9jxp5mYLRDnRdy8jDRI2bVuh','0233':'1B_xXea-9vRWaGLfpfR4bq7OPzGumXwZ6','0232':'1T5x_XsplertShkPaCM1Her0U4iEGUU7T','0231':'1RiBjID5zqQ9ujggSJgkkQgXijmxK7NN9','0230':'1aIKf2HmNf8YBP1FgCZWoxfZB4ydFODqg','0229':'1NuovAoAPoG_u8qO2NMXkrSuWnJU3yHsY','0228':'1kVYCtFAyJQ3GoxzqigUSNIDiKt4tJzZa','0227':'17DRcZ1HoZs8SCnJPVoXuj9Rar7e9Ytuh','0226':'1GG0cXdfpzHVSzIyf51DtdAmitdnVa-Li','0225':'1hS7WHinKIW88yt4pZiAM4EAfKTmh1XoO','0224':'1hlk_5RHt5SYPMAoDIOWQC_Npcp157thf','0223':'1QCJScfx7eZI03LelYtHQ4MhvsCdaspBK','0222':'1KDgxurwsBQUa9Ak9PkojVQOpjWD84Aom','0221':'1otAKXxSfKXm0kamaxKTlDZrggYuylXkU','0220':'1U_NC3NOLyYbZ0bVRTNfffewsNhsrkDB2','0219':'1XXaINYfz4VHZalm9snMWLKasXsVIY3-n','0218':'17nivchs1MEDHglnXPD477deYo3kLsUoc','0217':'1WluBQfuaExe9K6KeouQsWXuud9-407ep','0216':'1AneVoHZHV72Kn6xWu44uMF83wHYj89Yx','0215':'17KiXFODMZGVi1o0enqJDP6xO4afbcEec','0214':'18f05fkJ_Bx_E4fW7scUYGazcni-PVHjh','0213':'1xjzY-tbsgU2c0t3NAYDlJMP9ngPzxw_H','0212':'10eIfqzeOzkL8BS2Bj6wTgwxcOjt6QPe-','0211':'1YzMGFW2MHewhz8KXOdOoKY4jUfoB-v2A','0210':'1lZ_IshAorbAipG-jq96wx8By8zjFiSCz','0209':'1LiF7WAWkiCyzBKN7ZhcsXWfJJjlNc2aC','0208':'1Ak7vJScp5ZviBJ_5tMkGoI1xsMBuseMW','0207':'1q_EIltdXuO12D__p1T8w16SexvV6gTzs','0206':'1uqJN_QI_tH3nuQkYTmgx0hJxJoef-ZMU','0205':'1peh-hlMO_6CrnIigPwrxQLOqCrcZ0g2c','0204':'1kTtN_cB1dX6jT-VmVXqrB0l0dCTeyXOF','0203':'1wsGnOkkrzKMW_OK8uUXUecU702zXIBUv','0202':'1CQcixJXB6WNCh_tjD3EhJVFDMG0oHeuM','0201':'12QidOdIg0yUw_DY6LmLKJAm4SA902feo','0200':'1Iy-AiU9yiscgZqjKjmMv5DZL2GfEJSwP','0199':'1BOjO_aPNnj5DjIu2GAt3cuZh0pDt18kB','0198':'1hNrsdOICKOc1BaNtNPyGAdZ7nwiTgZRx','0197':'13AmZbqMOnxG3KXK8k9QGdzDDa5OySQre','0196':'19OatebfDjMkE_kOqx1p532VQ8W3vyd1u','0195':'1qMkk_P5fJev4jhqhGN7RYHQqdWhhbHZV','0194':'1rGBUus84u9dPC4AtqLNxK8w7GOFptF0O','0193':'1v3P0JkcGwRWKjrEykiyOf9ybmZOAnp0U','0192':'1VxMQJwrucpBOWoLBKBQFGaQDqaBC59LC','0191':'1Ebuzgi6CsYuD_g7eXAGkfjIia4HXgWCm','0189':'1p7I2Ob6ZJUHKVD-1RrJG4arCzrYRgX7Y','0188':'16fEyRn0IUlT2hGGL9F1G7nXmGPP1h-wu','0187':'1PnXlmc9yufTZ1qpp1xaiiOiakuC3-aUT','0186':'1qN-mxwe9NgfoxVIfvUdUA_6h0xtvNvfV','0185':'1PPZFPAdmnvv8g9RQW6PbUCIlD-r2nAXe','0184':'12aojMLgRlaiNcPpOqUQGNx1Mq_haePrn','0183':'1Fl9cLgxOO9MJnHoTJy0IQwzd1LPJyoQj','0182':'1gPUQtqJ_6P8buY1nSGwK-jCpbrW5I8ov','0181':'1-xfkWF4goNCDBfNqLMdd0b5Nl5uiJY_-','0180':'12Q-AbR97TvkfNJ9PV-IEFglVDELSppOY','0179':'1N6cIkOUHp3z5YUQDVvxUZswU1D2cFlax','0178':'1NlLv_4OF1acO2PY_7YkaUzKWwHvWKDDx','0177':'19r2lp0H4JlelYP0nwS47bRLiMkOME_yy','0176':'1TY9lbmTNGXJPUlSqW5z3A8LoCOkmsSl6','0175':'1J7JjzBNEdUo8oN13076MkzVPmfXV16qa','0174':'1gg_qkBrYqEe7lSeyRl7stQxhZt34_SfM','0173':'1bHpIWUJH-IC7B7PmhG1Uph885TGDNuEY','0172':'1zeAIhLgqqpDQ1em_NL7b2icgeGMllVmf','0171':'1W8wzt9xUwZPNyCIknbBzgFtGlOpyDEoU','0170':'1ldDyzPiUoT3CJMDEZlGYTD_T0wXyB01h','0169':'1iUG-uZL6pcnchUU1EFYcOORqeDXROLcm','0168':'1_MmSh20W82bKOQ8wDbEb7ewC0opcQwVO','0167':'1dK8ibfPINK3nl24dr-3SEz5fBOXFDBtW','0166':'1Ce26qs14DknBhqqD5njyUWOux1bJWhWy','0165':'1rvSrwrB5JCmedgPtoK2AuR_z_h-dMo87','0164':'1pFY9PuoEuBLn8nwTuWRD6xm-FLj0N8AU','0163':'1flKIPnGcApSkeKVZK3-dLCOJLMfFLg5_','0162':'1VXPPcxMie5sX1lQARIBUfudFbUla26Dv','0161':'1BSEnPVRu9T-7p68qoqyXYS2pCmJjtG97','0160':'1cMompzkVwmYZMjMf04q3KTDj_ZWoYOl0','0159':'1PB0E-z7OWL5SrJEvdGEMxuh1SGiLkgy1','0158':'1kBSkkvMOd-Hl2QF3RtsaFGu2zqXhPAzt','0157':'12-lylq6949cyv8nKTfhI6uKYELhPZmXB','0156':'1Ftspy8MDxkfoUG8f8yaMaE3gnQ78Cugg','0155':'1xHzospbywAgv6cWlBzxB1soHye0bXWXo','0154':'1ix5XUlz25RR-YciBy52kvK5iWz1Awf0F','0153':'1fT_BFhLbCaxJ6tc2MSuvPg_o0HuqiXf2','0152':'1xWgugmW4uIyRl-wzbUjVrKS2uRCINPEV','0151':'1PYLDHaFf8PnFcA3DO59zIBncdFF0Z4bb','0150':'1kn6ILqsmerNiLfOL6v7Df89adc-VUe8J','0149':'1T7CdGzFVzeXhayEKogs7x0-tjRdn-Uj5','0148':'1HPLTkTMuAZkFYiEUOz7m0cWGEWXurRdo','0147':'1Q_5RVe_bI6RmIRIiODJK-U3Ms_v5HW0V','0146':'1nRR6otshs8_mzypX411tnwAk2fFdYN-7','0145':'1MOX-2vvQVapqvMj9bugrHbY0-pImJys9','0144':'1m0yNt9-PLp0n19SFvA29L5Ju6rpZtVbo','0143':'1aQ292E2WV4o41X6UTOGbZb4QeCfGfIVY','0142':'1HW7EsYJW9vPU6-TiWB7Ddw-j3QohAm9a','0141':'1Pp_-hzAYjLoSIn9aoW37g5vB3_VMcNJ9','0140':'1gyLeBpPdGhCYZ3ZlgllqnHO7VmzIiLJS','0139':'1Qho-bhDZlpev9j1Lxs6X0zx6YSd5593J','0138':'1bd9qgeJuzqenueTcSeZ0mJ6PNTKSiv-k','0137':'18r9Ou3F69I2OuczFH1OIeK_hLHf5hzsE','0136':'1p8LgNzSaHk3txU_qtLau_cgjMcLS41pq','0135':'1kgJbtaUupIPh_Dx4VSjTivwkJHmaM1cW','0134':'147GgtcD9p6sbGAz3rMwkPDSktvLpoiu-','0133':'1lCZkTYM6HV9w7IBeftXmtcvNg-EmbhwJ','0132':'1KgT-WX0S4z8HM0tFkiIdDcuoFqxBCnnZ','0131':'1zVw7EZ3TpNGIAWxwgWlKe9XbWtN8DKez','0130':'1O-UIiiDy9iUST8vL4UYFHaeMTbS4UAyQ','0129':'1gbYBRufwcrdxOvqGzXiiB4pTgAcN_UMS','0128':'1StYNk8do-dH4Oe4b3KwdQ1NzJo8gRjFo','0127':'1u_vEwtN8zdglKVrcoTKWI-j392oJhFpB','0126':'1Ly214ba3l13W1fCU-of5z__elw5o4OXZ','0125':'1r4aYVVREgwDZMjdMXanuNNtXiKvkSVZo','0124':'1PFw4f5fMaoSSQfaZ7gt8Iazqr6vFh5_v','0123':'1-brpmuuxwuappnl0QXFPl5hMIJvkRUt7','0122':'1vSCabBb9iVHiDryMbtOx8WlbziEjOh31','0121':'1oX6Bw05ZiL1IY95UPW5dGpP8TCAqWXTS','0120':'1x6pzhILLHeJzp3mg3d7bpAQhR3iJR623','0119':'1NXz8CMDPN01EJlcyN7lX8Xfusa5O0u30','0118':'15g3IipPAvIDOp2ywTV3iFFplNKTwQrSh','0117':'1jFPrA6mXfSTOPTlkVHuckfiXwxVyOhxC','0116':'1dAYVIJQPNgudiogAXN9tCxCVB2y6iK8G','0115':'1-PPDll5uxEeLSVCRfYRZXtxCdZSNejP6','0114':'1xkjAwiWPJs6XmR7LpapWMqdPByrlXqse','0113':'1iljSltnPzWHx2oLSiWuu1JBBKgFTd1pZ','0112':'1HAFs0BzQ1UzsEu67Sw3jFI54ynIdBcW6','0111':'1Zdl5ZLE1DX_zTXZM9wZfY-9XOGLfApXB','0110':'1fqVwOJ8KKjrvcCgxePe1xGFFiWstYfMs','0109':'1Rb9dS7uQ7GigHIysHv-RFvYg9xJtLFDZ','0108':'1LroyNcNYTYTqKi1AH3AIcFbtG-_H46Gk','0107':'1pepqiyGGwP8L6pxBXUgZSKyacT63gW2X','0106':'14lxOqKYgalbgZD0IdQWKscFEo-mMn-ya','0105':'1yu66gmpSVNok6-MNLhxo75svQKo3V-bc','0104':'1ptoDBD5OrT8E_5FFxQoHYEOgxS657VcY','0103':'1317KfFDy0UGKnxFNmuDaWDhwPeXDlGny','0102':'19sAKWdr1QBUI1BRnAxCysbFeQ35JvM2j','0101':'1rWDAzCJwqUnlASOgkyVLCo5pKH-s8l2m','0100':'1UPZ1mScf2hIBlkvspCxrLggh8KHFL8YF','0099':'1Hgn1nuSthFpkyXfU_Nz8d3D9swQpe5UQ','0098':'1g_QpM1lphC1ieI3vJqdDSB3B8uPAH2vT','0097':'11--upv99-vDAAoamwsh1VcU4Ggi8TLrG','0096':'1hpDbXlwkYYuPK72sJPfleY0PG6rneFju','0095':'1ay3rC9Etlr5mbXf04LU1HW-JbisUDF6D','0094':'1jGaDlqW0B8IndEsrHK8KFHjf3UuPZj2O','0093':'1qlQGPe_kAfy8TGnJxWjiTlrGQBLFFr_H','0092':'1109ruioO2sDYK9LcHYpuIoLQGA-WdFow','0091':'1mMCKr_tbzGsevyDDgFQqy_7uZaWFJXm6','0090':'1a6ziU92gLvHPezu3pZV8SXeMZFUcjfgg','0089':'14feoJTRxBnBVTTgm1JHvOwnR58sruRoa','0088':'1S-t755REBWeDhs1CnIP4V6o_-7uoTeo4','0087':'1mpqazFqqZDa8o8pzL0n1R14x7DvpQFrb','0086':'17zHZeXJ_SkufaT2HZDId64YEMKLRp4c5','0085':'102bN3mB4bATlgd5_HkK36t9dBbiJXc8Q','0084':'1lRHvkyMArPRS3G2hVhuywsBxWDD2SyC3','0083':'116HytPHGyuFvfFfeQ56Hl_DFXoIp4Bod','0082':'1n8G3x8sCJag-mSRtQIqVBppQMAxRw_j7','0081':'1_4HhDCVAXul3HCXKf_VSkvDwBB_CHOtg','0080':'1sbmrAtEWc_Opva05XuVJzhNOFp7sHJih','0079':'1ogLh9Lsa2EVV6DgyACw8HRG2A4p3mVHq','0078':'1zh8AXAi8cjiUfiBTb2R4mhYOhJog-Cnn','0077':'10637WoiTZuVNqPlg6Ofu1u_O2LvYuEIH','0076':'129hEPB1XRCQdFShuhM9IFNMLLpZX3qG0','0075':'1dAtrGzhuAIRkbaTXhRb7sb5kd8_Yr4Nl','0074':'1sSIh__lX_8NL7KfeCJTNxBd5LuCSRzQ9','0073':'14M-3z7fuaXbX2wjaI_QBwLHIuK1n5WBn','0072':'1VOlZByXr1s12M5ywJMwLstkjIAuZSpr2','0071':'1jmOhsPHVBIlpQGCnTlvqo2FXaRL8tuvS','0070':'1zfu9ViwdBdQbUaIdXqic_jHT7ugeXb9d','0069':'1xC10Pfl58DFUfNsfXHrG9V288ISx2-Yi','0068':'1HoZ1QWhTS_LJzsBATWxJ3reHMSJX2j8b','0067':'1JxOKfJUtWcf9XRbi4Bq0bHpR3cHKp_9q','0066':'10IfHBmmp5EzhcK7Kq9y-spdFWCF30xxu','0065':'1xbyUFVC2ExdgSkinyDDYV6HFP8oTv_RL','0064':'1G23J-ITtw_AHNQX65BeLuhcogDJrzKp8','0063':'11ZG5OGX6M3k-S0gTWYgFpaSlawRlPwon','0062':'1dBcSe7DkKZIx3F546LQJs-Vqx8-uPGl3','0061':'1bkgqjf3vrW3GUQmtZOOZ1--XABZ-nTTr','0060':'1gYQ1fY6AFSpppKj9qmhZ7uDuGEywUqf-','0059':'1o1PkyeTXhSfNgygXJKZ2N8xYl7GucawB','0058':'1-bXWC50WNAtSGF5q_RLEneLUgXu4F-Gh','0057':'1wNpuHr5dFUugmeGlCPqfSCCebTYGkJtr','0056':'11GZiLNnC0zwWEWO0-m0OXEfKX6KiXwjX','0055':'1-fB5LMzU8qKt_c48ZFFcSCc9dV68nlk6','0054':'1kwkKQcfJB16vqhoatJmbtiuwn9f0uCLg','0053':'1oBdh1_kKeHOWFPWO5DDvEGk27YFxFWE9','0052':'1XLyYxaCn9NKNjBxso_pvLTHhG0egwYfY','0051':'1YTfXk0E65SuWVyRApZqDCEwp5DL3qrEx','0050':'1GLg6e3Vtv2_gmS66hLQXEpMrGokBIbuY','0049':'1-IvIpqAeq4mkPh9viNIpAW3lRthfvnUC','0048':'17j_d8PYju3DuObtH4kCR5m5RkGXb3i0j','0047':'1kDIvjaudnwg2iOxYXpxZivG0alHNxfgy','0046':'1vRyn1vzhWNK1EB0isFmpcfYJ5aZVnaMD','0045':'1QeWeMhNSsjThPwEaMW58Vq1OKUAM2IGE','0044':'10oLxNgYM4XGEul9RHaVfGX23o1q2-G5n','0043':'16AKSaz34Mn9yJQ5N2bdT4BmdzjhwdFC0','0042':'11Kgs1gsiXVLHsVj90Pl_nbKCsSu7AFoQ','0041':'1WUsPXZecP60kuNZG5_zvI1J0WKNWY1Z7','0040':'1dpdZOxRsTO13wBLTH8kfFB51UHSXktXW','0039':'1QNYJrlEknQOA4FLxz9-GExzoupt2KWde','0038':'1ERGt1vpcknI9YZroukSFVtmz_yb5qDGM','0037':'123DQcUw1XVCSFSimp4I73hfFPyaHt84P','0036':'1HTEEdLjP1Icg0VeZaRmiXQzxPXt9N7Wh','0035':'1QyxtoD5B1IFtoKVOFIdTTIVbxbpudBLB','0034':'1a_TL_qUazGu1lBb5fH__2OmRKBMAMUs1','0033':'1dwMGjq4KOTZpexpWRsDmfoZQ_vXz3cFn','0032':'1FP6jt_JwdoEyit6QXDftIa5qT5vrt_LW','0031':'1kjzdtwnDz0TQHo0D3uXmLxxP4GxA1mzM','0030':'1R-omN3q-IKSW_2hiToSvGGBKJMV2hY13','0029':'164fp_LaeRv5Z7SmKlQbZBSwz6_81yieX','0028':'16H3WSlV57KkPApu9OFiWCWW0jJWne2OI','0027':'1r30fPa_4_CYJG3Jyy5S-lxYwVV1XPRi2','0026':'105pstZJ97GHqa0RYlHYwc5W5vsImR9n5','0025':'1iAiKIVEsbJ2oqn2bPJe68RaBvZyJxE0k','0024':'13cnyKigRGI6wdLE03i1UH2Im6F_1DYrI','0023':'1GIGsVZeE2hlAkB8yK1vUOlLzPdck4l1g','0022':'1Ro_dqhd9kj8KJf2duZEbKDYFwGOchCVe','0021':'1W1XaLk-conB5sB6Zes9VmE0OMzoYGQ9n','0020':'1s40dU0g1Lqnxm-WTb3YiyxAWCTOw9FOz','0019':'1hh1NW6xNb0WzWxZxygE_NJNGrhtuv4W1','0018':'1J2U5WUuP5e1ifyXG9rW_PQTn064O_nM7','0017':'1h_fLPgjhh0AG9Fkrw6L09PlOJj3tWFsk','0016':'1N7ixleKrRTs-_b9d5BAIfQ2x0KHdOVem','0015':'1NgAwh_ktnQc7eWyHzbYrjfEpA9WS-AG6','0014':'1RK7TOkd9EFR1Ry1JyESD0ANjblkra5R3','0013':'1Gi9o7jFIfmVD8A-1MB3YquxjyMXfm1yP','0012':'10qqjuUWgt39mqGoWfIQLzyLDaU3act3j','0011':'1YSziisFxCC8Tfixal049nZFNqsv0bJZS','0010':'1hORxD7Pwp3kRa_9hoM7bFXwHK4n_dzLT','0009':'13GW1So4oH7py7hQXkieej-9NPx6bYxFR','0008':'18c6yZsf6xt96cadNgukbBIM4ob3GD7Vf','0007':'1l9taBDxfGZZFnPdW3PST7yF2tAExpBII','0006':'1m2oyp9t0OQHDsqWNAwYIAFGGATVyPRi9','0005':'1TX-pnMqFrYaKTTG4oHq5hHsL3lrdy2WB','0004':'19aysVzYKOmzzvQ85JDIfHG0Aoa_X8nc0','0003':'16NUviZJWBPvdCZ3R0J3Wz0p_J3_jKGjS','0002':'1qfWKEnSEu5lVDolWupbz7AGTPrfHRwqD','0001':'1aR8Qls4noiN1S0N1Sai1FZPSY2WuU3dI'
  };

  const params = new URLSearchParams(location.search);
  const mode = params.get('origen') === 'github' ? 'github' : 'gdrive';
  const endpoint = params.get('endpoint') === 'uc' ? 'uc' : 'lh3';
  const TEST_PATH = '/stock/natura/productos/';
  const testStart = performance.now();
  const stats = { mode, endpoint, assigned:0, loaded:0, failed:0, misses:0, durations:[], firstMs:null, startedAt:testStart };
  window.__IMAGE_SOURCE_TEST__ = stats;

  function productInfo(raw){
    try{
      const u = new URL(String(raw || ''), location.href);
      if(!u.pathname.includes(TEST_PATH)) return null;
      const filename = decodeURIComponent(u.pathname.split('/').pop() || '');
      const m = filename.match(/^(\d{4})(?=_|[.\s-]|$)/);
      return m ? { code:m[1], filename, url:u.href } : null;
    }catch(_){ return null; }
  }

  function driveUrl(id){
    return endpoint === 'uc'
      ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
      : `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}`;
  }

  function prepare(img, raw){
    const info = productInfo(raw);
    if(!info) return raw;
    const id = DRIVE_BY_CODE[info.code] || '';
    const key = `${info.code}|${info.filename}|${mode}|${endpoint}`;
    img.dataset.imageTestKey = key;
    img.dataset.imageTestStart = String(performance.now());
    img.dataset.imageTestRecorded = '0';
    img.dataset.imageTestCode = info.code;
    stats.assigned++;
    if(mode === 'github') return raw;
    if(!id){
      stats.misses++;
      img.dataset.imageTestMiss = '1';
      return `https://lh3.googleusercontent.com/d/__gdrive_missing_${info.code}__`;
    }
    img.dataset.imageTestDriveId = id;
    return driveUrl(id);
  }

  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if(srcDescriptor && srcDescriptor.set && srcDescriptor.get){
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: srcDescriptor.configurable,
      enumerable: srcDescriptor.enumerable,
      get: srcDescriptor.get,
      set(value){ return srcDescriptor.set.call(this, prepare(this, value)); }
    });
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value){
    if(this instanceof HTMLImageElement && String(name).toLowerCase() === 'src'){
      value = prepare(this, value);
    }
    return nativeSetAttribute.call(this, name, value);
  };

  function record(img, ok){
    if(!(img instanceof HTMLImageElement)) return;
    if(!img.dataset.imageTestKey || img.dataset.imageTestRecorded === '1') return;
    img.dataset.imageTestRecorded = '1';
    const start = Number(img.dataset.imageTestStart || 0);
    const elapsed = start > 0 ? Math.max(0, performance.now() - start) : 0;
    if(ok){
      stats.loaded++;
      stats.durations.push(elapsed);
      if(stats.firstMs === null) stats.firstMs = performance.now() - testStart;
    }else{
      stats.failed++;
    }
    renderPanel();
  }

  document.addEventListener('load', e => record(e.target, true), true);
  document.addEventListener('error', e => record(e.target, false), true);

  function percentile(values, p){
    if(!values.length) return null;
    const s = values.slice().sort((a,b)=>a-b);
    const idx = Math.min(s.length-1, Math.max(0, Math.ceil(p*s.length)-1));
    return s[idx];
  }
  function average(values){ return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null; }
  function fmt(v){ return Number.isFinite(v) ? `${Math.round(v)} ms` : '—'; }

  let panel;
  function renderPanel(){
    if(!document.body) return;
    if(!panel){
      panel = document.createElement('aside');
      panel.id = 'image-source-test-panel';
      panel.style.cssText = 'position:fixed;z-index:2147483647;right:10px;bottom:10px;max-width:330px;padding:12px 14px;border-radius:12px;background:rgba(15,18,24,.94);color:#fff;font:12px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);text-align:left';
      document.body.appendChild(panel);
    }
    const avg = average(stats.durations);
    const med = percentile(stats.durations,.5);
    const p90 = percentile(stats.durations,.9);
    const q = new URLSearchParams(location.search);
    const base = location.pathname;
    panel.innerHTML = `
      <div style="font-weight:800;font-size:13px;margin-bottom:5px">PRUEBA TEMPORAL DE IMÁGENES</div>
      <div>Origen: <b>${mode === 'gdrive' ? `Google Drive (${endpoint})` : 'GitHub Pages'}</b></div>
      <div>Solicitadas: <b>${stats.assigned}</b> · Cargadas: <b>${stats.loaded}</b> · Errores: <b>${stats.failed}</b> · Sin mapa: <b>${stats.misses}</b></div>
      <div>Primera imagen: <b>${fmt(stats.firstMs)}</b></div>
      <div>Promedio: <b>${fmt(avg)}</b> · Mediana: <b>${fmt(med)}</b> · P90: <b>${fmt(p90)}</b></div>
      <div style="margin-top:7px;display:flex;gap:5px;flex-wrap:wrap">
        <a href="${base}?origen=github" style="color:#9bd1ff">GitHub</a>
        <a href="${base}?origen=gdrive&endpoint=lh3" style="color:#9bd1ff">Drive lh3</a>
        <a href="${base}?origen=gdrive&endpoint=uc" style="color:#9bd1ff">Drive uc</a>
      </div>
      <div style="margin-top:6px;opacity:.78">Para comparar en frío, abre cada modo en una ventana privada nueva y recorre las mismas categorías.</div>`;
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderPanel, {once:true});
  else renderPanel();
  setInterval(renderPanel, 1000);
})();
