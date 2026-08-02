import json
import re

with open('c:\\KINETIX\\kinetix-api\\scripts\\treino.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for day in data:
    pace = day.get('pace_alvo_min_km', 'OFF')
    if pace != 'OFF':
        # If it's just MM:SS, convert it to a range MM:SS - MM:SS+15
        match = re.match(r'^(\d{2}):(\d{2})$', pace)
        if match:
            m = int(match.group(1))
            s = int(match.group(2))
            
            s += 15
            if s >= 60:
                s -= 60
                m += 1
                
            m_str = f"{m:02d}"
            s_str = f"{s:02d}"
            
            day['pace_alvo_min_km'] = f"{pace} - {m_str}:{s_str}"

with open('c:\\KINETIX\\kinetix-api\\scripts\\treino.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("treino.json atualizado com ranges de pace.")
