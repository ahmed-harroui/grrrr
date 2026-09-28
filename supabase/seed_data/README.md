# GRRR Care Knowledge Base - Seed Data

## Structure des fichiers

```
seed_data/
├── species.json          # 18 espèces/catégories avec emoji
├── sources.json          # 20 sources vétérinaires référencées
├── documents.json        # 24 fiches de connaissances
├── chunks.json           # Chunks prêts pour RAG/vector search
├── emergency_guides.json # Guides d'urgence (respiration, empoisonnement, saignement)
└── manifest.json         # Métadonnées du package
```

## Contenu

- **Species**: 🐶 chien, 🐱 chat, 🐰 lapin, 🐹 hamster, 🐹 cochon d'Inde, 🐭 souris, 🐀 rat, 🦦 furet, 🐦 oiseaux, 🦜 perroquets, 🐔 poules, 🦎 reptiles, 🐍 serpents, 🐢 tortues, 🐸 amphibiens, 🐠 poissons, 🐴 cheval, 🐾 autre

- **Sources**: Merck Veterinary Manual, RSPCA, FDA, et 17 autres sources de référence vétérinaire

- **24 Knowledge Fact Sheets**: Nutrition, Prévention, Symptômes, Urgences, Médicaments, Habitat, Comportement

- **Niveaux de risque**: low, moderate, high, emergency

- **Tags**: Espèces, catégories, sources, statut de révision

- **Sécurité médicaments**: Stockage, erreurs de dosage, exposition accidentelle, restrictions de prescription

## Comment charger les données

### Option 1: Via Supabase CLI (Recommandé)

```bash
cd GRRRR/supabase
supabase db push  # Applique le migration 002_knowledge_base.sql

# Ensuite, charge les données via seed
supabase seed run
```

### Option 2: Via scripts Node.js

Place les fichiers JSON dans ce dossier, puis utilise un script pour les charger:

```javascript
import { createClient } from '@supabase/supabase-js';
import speciesData from './species.json';
import sourcesData from './sources.json';
import documentsData from './documents.json';
import chunksData from './chunks.json';
import emergencyData from './emergency_guides.json';

const supabase = createClient(URL, KEY);

async function seedKnowledgeBase() {
  // 1. Load sources first
  await supabase.from('knowledge_sources').insert(sourcesData);
  
  // 2. Load documents
  await supabase.from('knowledge_documents').insert(documentsData);
  
  // 3. Load chunks
  await supabase.from('knowledge_chunks').insert(chunksData);
  
  // 4. Load emergency guides
  await supabase.from('emergency_guides').insert(emergencyData);
}

seedKnowledgeBase();
```

### Option 3: Télécharger les fichiers JSON du package

Tu dois d'abord télécharger le fichier `📦 GRRR Care Knowledge Base V1` qui contient:
- species.json
- sources.json
- documents.json
- chunks.json
- emergency_guides.json
- manifest.json

Place ces fichiers dans ce dossier `seed_data/`.

## Schéma compatible

Le fichier `002_knowledge_base.sql` crée:
- ✅ `knowledge_sources` - Sources vétérinaires
- ✅ `knowledge_documents` - Fiches de connaissances
- ✅ `knowledge_chunks` - Chunks pour RAG avec embeddings pgvector
- ✅ `emergency_guides` - Guides d'urgence séparés
- ✅ Indexes pgvector pour vector search
- ✅ RLS (Row Level Security) - lecture publique, écriture admin
- ✅ Fonction `search_knowledge()` pour similarité search

## Prochaines étapes

1. ✅ Migration schema: `002_knowledge_base.sql` ← DÉJÀ CRÉÉE
2. ⏳ Télécharge le package `GRRR Care Knowledge Base V1`
3. ⏳ Place les fichiers JSON dans ce dossier
4. ⏳ Lance `supabase db push` pour appliquer le migration
5. ⏳ Charge les données (voir options ci-dessus)
6. ⏳ Teste les queries vector search depuis l'API
7. ⏳ Phase 3: Intègre avec Claude AI Agent Orchestrator

## Format des données

### knowledge_documents.json
```json
{
  "id": "uuid",
  "title": "string",
  "category": "nutrition|prevention|symptoms|emergency|medication|habitat|behavior",
  "species": ["dog", "cat", "rabbit"],
  "tags": ["allergy", "food", "dry-food"],
  "risk_level": "low|moderate|high|emergency",
  "source_id": "uuid",
  "content": "string",
  "is_published": true
}
```

### knowledge_chunks.json
```json
{
  "id": "uuid",
  "document_id": "uuid",
  "chunk_text": "string",
  "chunk_index": 0,
  "embedding": [0.123, 0.456, ...],
  "metadata": {
    "species": ["dog"],
    "risk_level": "moderate"
  }
}
```

## Sécurité

- ✅ RLS: Lecture publique (santé animale est info publique)
- ✅ Écriture admin uniquement (gérée par panel admin)
- ✅ Pas de prescription IA: Guides recommandent toujours "appeler un vétérinaire"
- ✅ Conformité FDA: Stockage sécurisé des médicaments, protocoles d'exposition
- ✅ Sources vérifiées: Merck, RSPCA, FDA référencées

---

**Questions?** Ouvre une issue ou contacte l'équipe GRRR Care.
