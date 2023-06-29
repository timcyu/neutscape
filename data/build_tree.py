r"""script for bulding phylogenetic trees using fasttree"""

import os
from Bio import Phylo, SeqIO

# standardize seq length
adjusted_sequences = []

# open the original FASTA file and read in the sequences
with open('yang2022/yang2022_HA_alignment.fasta', 'r') as original:
    for record in SeqIO.parse(original, 'fasta'):
        if record.id != 'A/Victoria/1975':
            # Add a gap at the correct position where Vic75 gets an insertion
            new_seq = record.seq[:23] + '-' + record.seq[23:]
            record.seq = new_seq
        adjusted_sequences.append(record)

# Write the adjusted sequences to a new FASTA file
with open('yang2022/yang2022_HA_alignment_std.fasta', 'w') as adjusted:
    SeqIO.write(adjusted_sequences, adjusted, 'fasta')

os.system('fasttree yang2022/yang2022_HA_alignment_std.fasta > yang2022/yang2022_tree_raw.nwk')
T = Phylo.read('yang2022/yang2022_tree_raw.nwk', 'newick')
T.root_with_outgroup('A/HongKong/1968')
T.ladderize()
Phylo.write(T, 'yang2022/yang2022_tree.nwk', 'newick')