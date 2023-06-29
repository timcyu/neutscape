# Data
This directory stores datasets that are used for the visualization. Currently, the following datasets are included:
- [Yang et al. (eLife, 2022)](yang2022)

## Yang et al. (eLife, 2022)
This is the [link](https://elifesciences.org/articles/81457) to the paper. 

Directory contents:
- [figure-1-source-data-1-hi-titer-at-baseline.csv](yang2022/figure-1-source-data-1-hi-titer-at-baseline.csv) contains HI titer data derived from serum samples from 777 participants of the Fluscape cohort in Guangzhou, collected at two time points (2009-2011, 2014-2015). Participants were aged 2-86. Each serum was measured against 21 H3N2 strains spanning from 1968-2014. Only 0.6% (n=5) participants self-reported influenza vaccinations between the two visits, so any changes in HI titers between two visits is assumed to be due to natural exposures.
- [yang2022_HA_alignment.fasta](yang2022/yang2022_HA_alignment.fasta) contains the full HA amino acid sequences of 20 H3N2 strains described in the study. Note I could not find the full HA sequence for `A/Mississippi/1985`, only the HA1 sequence, so it is excluded from the analysis.
- [yang2022_HA_accession.csv](yang2022/yang2022_HA_accession.csv) contains the accession numbers for each of the HA sequences.
