package com.shappire.stickers;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // O plugin próprio precisa ser registrado antes da bridge ser inicializada.
        registerPlugin(StickerPackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
