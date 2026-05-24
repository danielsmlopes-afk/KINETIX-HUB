import 'package:flutter/material.dart';
import '../../../core/network/api_client.dart';

class AddRaceDialog extends StatefulWidget {
  const AddRaceDialog({super.key});

  @override
  State<AddRaceDialog> createState() => _AddRaceDialogState();
}

class _AddRaceDialogState extends State<AddRaceDialog> {
  final _formKey = GlobalKey<FormState>();
  
  String _name = '';
  String _category = 'P2';
  String _distance = '';
  String _date = '';
  String _startTime = '06:00';
  String _startLocation = '';
  String _targetPace = 'Auto';
  
  bool _isLoading = false;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() => _isLoading = true);

    try {
      final payload = {
        'name': _name,
        'category': _category,
        'date': '${_date}T$_startTime:00Z',
        'distance': num.tryParse(_distance) ?? 0,
        'startTime': _startTime,
        'startLocation': _startLocation,
        'targetPace': _targetPace,
      };

      // 1. Envia a Prova para o Banco de Dados
      final response = await ApiClient.post('/races', body: payload);
      final race = response['race'];
      final requiresMacrocycle = response['requiresMacrocycle'] == true;

      // 2. Aciona o Head Coach se a IA solicitou um recálculo por ser uma P1
      if (requiresMacrocycle && race != null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Prova P1 detectada. Head Coach IA recalculando macrociclo...')),
          );
        }
        // Chama o Controlador da IA enviando o ID da prova!
        await ApiClient.post('/head-coach/macrocycle', body: {'raceId': race['id']});
      }

      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16, right: 16, top: 24,
      ),
      decoration: BoxDecoration(
        color: Colors.blueGrey.shade900,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Registrar Missão (Prova)', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.amberAccent)),
              const SizedBox(height: 16),
              TextFormField(decoration: const InputDecoration(labelText: 'Nome da Prova (ex: SP City Marathon)'), onSaved: (val) => _name = val ?? '', validator: (val) => val == null || val.isEmpty ? 'Campo obrigatório' : null),
              DropdownButtonFormField<String>(
                value: _category,
                decoration: const InputDecoration(labelText: 'Categoria Tática'),
                items: const [
                  DropdownMenuItem(value: 'P1', child: Text('P1 - Alvo Principal')),
                  DropdownMenuItem(value: 'P2', child: Text('P2 - Prova Preparatória')),
                  DropdownMenuItem(value: 'P3', child: Text('P3 - Treino de Luxo')),
                ],
                onChanged: (val) => setState(() => _category = val!),
              ),
              Row(children: [
                Expanded(child: TextFormField(decoration: const InputDecoration(labelText: 'Distância (km)'), keyboardType: TextInputType.number, onSaved: (val) => _distance = val ?? '')),
                const SizedBox(width: 16),
                Expanded(child: TextFormField(decoration: const InputDecoration(labelText: 'Data (YYYY-MM-DD)'), onSaved: (val) => _date = val ?? '')),
              ]),
              Row(children: [
                Expanded(child: TextFormField(initialValue: _startTime, decoration: const InputDecoration(labelText: 'Largada (HH:MM)'), onSaved: (val) => _startTime = val ?? '')),
                const SizedBox(width: 16),
                Expanded(child: TextFormField(initialValue: _targetPace, decoration: const InputDecoration(labelText: 'Pace Alvo (ou Auto)'), onSaved: (val) => _targetPace = val ?? '')),
              ]),
              TextFormField(decoration: const InputDecoration(labelText: 'Localização (ex: São Paulo, BR)'), onSaved: (val) => _startLocation = val ?? ''),
              const SizedBox(height: 24),
              _isLoading ? const CircularProgressIndicator() : ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: Colors.tealAccent.shade400, foregroundColor: Colors.black, minimumSize: const Size(double.infinity, 50)), onPressed: _submit, child: const Text('CONFIRMAR REGISTRO', style: TextStyle(fontWeight: FontWeight.bold))),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}